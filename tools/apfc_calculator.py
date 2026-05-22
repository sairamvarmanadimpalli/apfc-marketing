#!/usr/bin/env python3
"""
APFC Bulk Bill Calculator - DeepAndWide Technologies Pvt. Ltd.

Fetches TSSPDCL bills and calculates APFC panel sizing for multiple SC numbers.

Usage:
    python apfc_calculator.py SC1 SC2 SC3 ...
    python apfc_calculator.py --file sc_numbers.txt
    python apfc_calculator.py --file sc_numbers.txt --output results.csv

Formulas:
    LT: kVAR = Contracted Load (kW) x 0.8
    HT: kVAR = RMD (kVA) x 0.8
"""

import argparse
import csv
import json
import re
import sys
import time
from dataclasses import dataclass
from typing import Optional, List
import urllib.request
import urllib.error

# API Configuration
API_BASE = "https://apfc-bill-fetcher.sairamvarmanadimpalli.workers.dev"

# Panel Configurations (same as frontend)
PANEL_CONFIGS = [
    {"rating": 11, "steps": [1, 2, 3, 5]},
    {"rating": 15, "steps": [2, 3, 5, 5]},
    {"rating": 20, "steps": [2, 3, 5, 10]},
    {"rating": 25, "steps": [2, 3, 5, 5, 10]},
    {"rating": 30, "steps": [2, 3, 5, 10, 10]},
    {"rating": 35, "steps": [2, 3, 5, 5, 10, 10]},
    {"rating": 40, "steps": [2, 3, 5, 10, 20]},
    {"rating": 45, "steps": [2, 3, 5, 5, 10, 20]},
    {"rating": 50, "steps": [2, 3, 5, 10, 10, 20]},
    {"rating": 60, "steps": [2, 3, 5, 10, 20, 20]},
    {"rating": 70, "steps": [2, 3, 5, 10, 10, 20, 20]},
    {"rating": 80, "steps": [2, 3, 5, 10, 20, 20, 20]},
    {"rating": 90, "steps": [2, 3, 5, 10, 10, 20, 20, 20]},
    {"rating": 100, "steps": [2, 3, 5, 10, 20, 20, 20, 20]},
    {"rating": 110, "steps": [2, 3, 5, 10, 10, 20, 20, 20, 20]},
    {"rating": 120, "steps": [2, 3, 5, 10, 20, 20, 20, 20, 20]},
]

# Step Pricing
STEP_PRICES = {
    1: 2400,
    2: 4000,
    3: 5400,
    5: 8000,
    10: 14000,
    20: 28000,
    40: 56000,
}


@dataclass
class BillData:
    """Parsed bill data"""
    sc_no: str
    type: str  # LT or HT
    name: Optional[str] = None
    address: Optional[str] = None
    category: Optional[str] = None
    contracted_load: Optional[float] = None  # kW for LT, kVA for HT
    recorded_md: Optional[float] = None  # kW for LT, kVA for HT
    kwh: Optional[int] = None
    kvah: Optional[int] = None
    bill_amount: Optional[float] = None
    power_factor: Optional[float] = None
    tariff: Optional[float] = None
    error: Optional[str] = None


@dataclass
class CalculationResult:
    """APFC calculation result"""
    sc_no: str
    type: str
    name: str
    contracted_load: float
    recorded_md: float
    kwh: int
    kvah: int
    reactive_diff: int
    power_factor: float
    required_kvar_raw: float
    recommended_kvar: int
    steps: List[int]
    panel_cost: int
    monthly_loss: float
    annual_loss: float
    roi_months: float
    tariff: float
    error: Optional[str] = None


def detect_type(sc_no: str) -> Optional[str]:
    """Detect LT or HT from SC number format"""
    s = sc_no.strip().upper()
    if re.match(r'^[A-Z]{2,4}\d+$', s):
        return "HT"
    if re.match(r'^\d{6,15}$', s):
        return "LT"
    return None


def price_for_step(step_kvar: int) -> int:
    """Get price for a capacitor step"""
    if step_kvar in STEP_PRICES:
        return STEP_PRICES[step_kvar]
    return step_kvar * 1400  # Fallback


def pick_step_progression(required_kvar: int) -> dict:
    """Select panel configuration based on required kVAR"""
    # Rounding rules
    if required_kvar <= 45:
        rounded = ((required_kvar + 4) // 5) * 5  # ceil to nearest 5
    else:
        rounded = ((required_kvar + 9) // 10) * 10  # ceil to nearest 10

    if rounded == 0:
        rounded = 5  # Minimum

    # Find matching panel
    for panel in PANEL_CONFIGS:
        if panel["rating"] >= rounded:
            return {
                "steps": panel["steps"],
                "total": panel["rating"],
                "oversized": False
            }

    # Custom configuration for > 120 kVAR
    steps = [2, 3, 5]
    sum_so_far = 10
    remaining = rounded - sum_so_far
    available_steps = [40, 20, 10, 5]

    while remaining > 0 and len(steps) < 16:
        chosen_step = None
        for step in available_steps:
            if step <= sum_so_far and step <= remaining + 10:
                chosen_step = step
                break

        if not chosen_step:
            chosen_step = min(sum_so_far, remaining)
            if chosen_step >= 35:
                chosen_step = 40
            elif chosen_step >= 15:
                chosen_step = 20
            elif chosen_step >= 7:
                chosen_step = 10
            else:
                chosen_step = 5

        steps.append(chosen_step)
        sum_so_far += chosen_step
        remaining -= chosen_step

    total = sum(steps)
    return {
        "steps": steps,
        "total": total,
        "oversized": True
    }


def calculate_panel_cost(steps: List[int], custom_addon: int = 0) -> int:
    """Calculate total panel cost"""
    base_cost = sum(price_for_step(s) for s in steps)

    if custom_addon > 0:
        base_cost += price_for_step(custom_addon)

    # Minimum charge
    if base_cost < 40000:
        base_cost += 3000

    return base_cost


def fetch_bill(sc_no: str, bill_type: Optional[str] = None) -> BillData:
    """Fetch bill data from API"""
    if not bill_type:
        bill_type = detect_type(sc_no)

    if not bill_type:
        return BillData(
            sc_no=sc_no,
            type="UNKNOWN",
            error="Could not detect connection type (LT/HT)"
        )

    url = f"{API_BASE}/api/bill?scno={sc_no}&type={bill_type}"

    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "APFC-Calculator/1.0",
            "Accept": "application/json"
        })

        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode())

        if not data.get("ok"):
            return BillData(
                sc_no=sc_no,
                type=bill_type,
                error=data.get("error", "Unknown API error")
            )

        d = data.get("data", {})

        # Extract fields based on type
        if bill_type == "HT":
            contracted_load = d.get("contractedMdKva")
            recorded_md = d.get("recordedMdKva")
        else:  # LT
            contracted_load = d.get("connectedLoadKw")
            recorded_md = d.get("recordedMdKw")

        return BillData(
            sc_no=sc_no,
            type=bill_type,
            name=d.get("consumerName"),
            address=d.get("address"),
            category=d.get("category"),
            contracted_load=contracted_load,
            recorded_md=recorded_md,
            kwh=d.get("kwh"),
            kvah=d.get("kvah"),
            bill_amount=d.get("billAmount"),
            power_factor=d.get("powerFactor"),
            tariff=d.get("energyChargeRate") or d.get("effectiveTariff")
        )

    except urllib.error.URLError as e:
        return BillData(
            sc_no=sc_no,
            type=bill_type,
            error=f"Network error: {e}"
        )
    except json.JSONDecodeError as e:
        return BillData(
            sc_no=sc_no,
            type=bill_type,
            error=f"Invalid JSON response: {e}"
        )
    except Exception as e:
        return BillData(
            sc_no=sc_no,
            type=bill_type,
            error=f"Error: {e}"
        )


def calculate_apfc(bill: BillData, default_tariff: float = 8.18) -> CalculationResult:
    """Calculate APFC panel sizing and ROI"""
    if bill.error:
        return CalculationResult(
            sc_no=bill.sc_no,
            type=bill.type,
            name="-",
            contracted_load=0,
            recorded_md=0,
            kwh=0,
            kvah=0,
            reactive_diff=0,
            power_factor=0,
            required_kvar_raw=0,
            recommended_kvar=0,
            steps=[],
            panel_cost=0,
            monthly_loss=0,
            annual_loss=0,
            roi_months=0,
            tariff=0,
            error=bill.error
        )

    # Get values with defaults
    cl = bill.contracted_load or 0
    rmd = bill.recorded_md or cl
    kwh = bill.kwh or 0
    kvah = bill.kvah or 0
    tariff = bill.tariff or default_tariff

    # Calculate reactive difference
    reactive_diff = max(0, kvah - kwh)

    # Calculate power factor
    pf = kwh / kvah if kvah > 0 else 0

    # Calculate losses
    monthly_loss = reactive_diff * tariff
    annual_loss = monthly_loss * 12

    # kVAR sizing based on connection type
    if bill.type == "HT":
        # HT: RMD (kVA) x 0.8
        required_kvar_raw = rmd * 0.8
    else:
        # LT: Contracted Load (kW) x 0.8
        required_kvar_raw = cl * 0.8

    # Get panel configuration
    step_result = pick_step_progression(int(required_kvar_raw))
    recommended_kvar = step_result["total"]
    steps = step_result["steps"]

    # Calculate cost
    panel_cost = calculate_panel_cost(steps)

    # Calculate ROI
    roi_months = panel_cost / monthly_loss if monthly_loss > 0 else 0

    return CalculationResult(
        sc_no=bill.sc_no,
        type=bill.type,
        name=bill.name or "-",
        contracted_load=cl,
        recorded_md=rmd,
        kwh=kwh,
        kvah=kvah,
        reactive_diff=reactive_diff,
        power_factor=round(pf, 3),
        required_kvar_raw=round(required_kvar_raw, 1),
        recommended_kvar=recommended_kvar,
        steps=steps,
        panel_cost=panel_cost,
        monthly_loss=round(monthly_loss, 2),
        annual_loss=round(annual_loss, 2),
        roi_months=round(roi_months, 1),
        tariff=tariff
    )


def format_currency(amount: float) -> str:
    """Format as Indian Rupees"""
    if amount >= 100000:
        return f"Rs.{amount/100000:.1f}L"
    if amount >= 1000:
        return f"Rs.{amount/1000:.1f}k"
    return f"Rs.{int(amount)}"


def print_results(results: List[CalculationResult]):
    """Print results as a formatted table"""
    # Header
    print("\n" + "=" * 140)
    print("APFC BULK CALCULATION RESULTS - DeepAndWide Technologies Pvt. Ltd.")
    print("=" * 140)

    # Column headers
    headers = [
        "SC No", "Type", "Name", "C.L", "RMD", "kWh", "kVAh", "Diff",
        "PF", "kVAR", "Steps", "Cost", "Loss/Mo", "ROI"
    ]

    print(f"\n{'SC No':<12} {'Type':<4} {'Name':<25} {'C.L':>6} {'RMD':>7} "
          f"{'kWh':>7} {'kVAh':>7} {'Diff':>6} {'PF':>5} {'kVAR':>5} "
          f"{'Steps':<15} {'Cost':>8} {'Loss/Mo':>9} {'ROI':>6}")
    print("-" * 140)

    for r in results:
        if r.error:
            print(f"{r.sc_no:<12} {r.type:<4} ERROR: {r.error}")
            continue

        steps_str = "+".join(str(s) for s in r.steps)
        if len(steps_str) > 15:
            steps_str = steps_str[:12] + "..."

        name = r.name[:25] if r.name else "-"

        print(f"{r.sc_no:<12} {r.type:<4} {name:<25} {r.contracted_load:>6.0f} "
              f"{r.recorded_md:>7.1f} {r.kwh:>7,} {r.kvah:>7,} {r.reactive_diff:>6,} "
              f"{r.power_factor:>5.2f} {r.recommended_kvar:>5} {steps_str:<15} "
              f"{format_currency(r.panel_cost):>8} {format_currency(r.monthly_loss):>9} "
              f"{r.roi_months:>5.1f}M")

    print("-" * 140)

    # Summary
    valid_results = [r for r in results if not r.error]
    if valid_results:
        total_kvar = sum(r.recommended_kvar for r in valid_results)
        total_cost = sum(r.panel_cost for r in valid_results)
        total_monthly_loss = sum(r.monthly_loss for r in valid_results)
        total_annual_loss = sum(r.annual_loss for r in valid_results)

        print(f"\nSUMMARY: {len(valid_results)} bills processed")
        print(f"  Total kVAR Required: {total_kvar} kVAR")
        print(f"  Total Panel Cost:    {format_currency(total_cost)}")
        print(f"  Total Monthly Loss:  {format_currency(total_monthly_loss)}")
        print(f"  Total Annual Loss:   {format_currency(total_annual_loss)}")
        if total_monthly_loss > 0:
            avg_roi = total_cost / total_monthly_loss
            print(f"  Average ROI:         {avg_roi:.1f} months")

    if len(results) != len(valid_results):
        print(f"\n  Errors: {len(results) - len(valid_results)} bills failed to fetch")

    print()


def export_csv(results: List[CalculationResult], filename: str):
    """Export results to CSV"""
    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)

        # Header
        writer.writerow([
            "SC No", "Type", "Name", "Contracted Load", "Recorded MD",
            "kWh", "kVAh", "Reactive Diff", "Power Factor", "Required kVAR (raw)",
            "Recommended kVAR", "Steps", "Panel Cost", "Monthly Loss",
            "Annual Loss", "ROI (months)", "Tariff", "Error"
        ])

        # Data
        for r in results:
            writer.writerow([
                r.sc_no,
                r.type,
                r.name,
                r.contracted_load,
                r.recorded_md,
                r.kwh,
                r.kvah,
                r.reactive_diff,
                r.power_factor,
                r.required_kvar_raw,
                r.recommended_kvar,
                "+".join(str(s) for s in r.steps),
                r.panel_cost,
                r.monthly_loss,
                r.annual_loss,
                r.roi_months,
                r.tariff,
                r.error or ""
            ])

    print(f"Results exported to: {filename}")


def main():
    parser = argparse.ArgumentParser(
        description="APFC Bulk Bill Calculator - DeepAndWide Technologies",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python apfc_calculator.py 113400807 MCL3800 SEC2112
  python apfc_calculator.py --file sc_numbers.txt
  python apfc_calculator.py --file sc_numbers.txt --output results.csv

Formulas:
  LT: kVAR = Contracted Load (kW) x 0.8
  HT: kVAR = RMD (kVA) x 0.8
        """
    )

    parser.add_argument("sc_numbers", nargs="*", help="SC numbers to process")
    parser.add_argument("-f", "--file", help="File with SC numbers (one per line)")
    parser.add_argument("-o", "--output", help="Output CSV file")
    parser.add_argument("-t", "--tariff", type=float, default=8.18,
                        help="Default tariff (Rs./kVArh) if not in bill (default: 8.18)")
    parser.add_argument("-d", "--delay", type=float, default=1.0,
                        help="Delay between API calls in seconds (default: 1.0)")
    parser.add_argument("-q", "--quiet", action="store_true",
                        help="Minimal output (only show summary)")

    args = parser.parse_args()

    # Collect SC numbers
    sc_numbers = list(args.sc_numbers) if args.sc_numbers else []

    if args.file:
        try:
            with open(args.file, 'r') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#'):
                        sc_numbers.append(line)
        except FileNotFoundError:
            print(f"Error: File not found: {args.file}", file=sys.stderr)
            sys.exit(1)

    if not sc_numbers:
        parser.print_help()
        print("\nError: No SC numbers provided", file=sys.stderr)
        sys.exit(1)

    # Remove duplicates while preserving order
    seen = set()
    unique_sc = []
    for sc in sc_numbers:
        if sc not in seen:
            seen.add(sc)
            unique_sc.append(sc)
    sc_numbers = unique_sc

    print(f"Processing {len(sc_numbers)} SC number(s)...")

    results = []
    for i, sc_no in enumerate(sc_numbers):
        if not args.quiet:
            detected = detect_type(sc_no) or "?"
            print(f"  [{i+1}/{len(sc_numbers)}] Fetching {sc_no} ({detected})...", end=" ", flush=True)

        bill = fetch_bill(sc_no)
        result = calculate_apfc(bill, args.tariff)
        results.append(result)

        if not args.quiet:
            if result.error:
                print(f"ERROR: {result.error}")
            else:
                print(f"OK - {result.recommended_kvar} kVAR, {format_currency(result.panel_cost)}")

        # Rate limiting
        if i < len(sc_numbers) - 1 and args.delay > 0:
            time.sleep(args.delay)

    # Output results
    print_results(results)

    # Export to CSV if requested
    if args.output:
        export_csv(results, args.output)


if __name__ == "__main__":
    main()
