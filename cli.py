"""
CommitRoast: terminal version.

Usage (inside any git repository):
    python cli.py                          # review staged changes
    python cli.py --persona "17th Century Pirate Captain"
    python cli.py --list                   # show all personas
    python cli.py --commit                 # review, then offer to commit with the suggested message
"""

import argparse
import subprocess
import sys

from dotenv import load_dotenv
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Confirm
from rich.table import Table

from core import PERSONAS, CommitRoastError, analyze_diff, diff_stats, find_persona, resolve_api_key

load_dotenv()  # lets the terminal tool read GEMINI_API_KEY from a .env file too
console = Console()


def run_git(*args: str) -> subprocess.CompletedProcess:
    # errors="replace" stops the tool crashing on files that aren't valid UTF-8
    return subprocess.run(["git", *args], capture_output=True, text=True, encoding="utf-8", errors="replace")


def get_git_diff() -> tuple[str, bool]:
    """Returns (diff, is_staged). Prefers staged changes, falls back to unstaged."""
    try:
        if run_git("rev-parse", "--is-inside-work-tree").returncode != 0:
            raise FileNotFoundError
    except FileNotFoundError:
        console.print("[bold red]Error:[/] run this inside a git repository (and make sure git is installed).")
        sys.exit(1)

    staged = run_git("diff", "--cached").stdout.strip()
    if staged:
        return staged, True
    return run_git("diff").stdout.strip(), False


def colour_for(score: int) -> str:
    return "green" if score <= 3 else "yellow" if score <= 6 else "red"


def main() -> None:
    parser = argparse.ArgumentParser(description="Roast your git diff and get a commit message.")
    parser.add_argument("persona_pos", nargs="?", help=argparse.SUPPRESS)  # old style: python cli.py "Pirate"
    parser.add_argument("-p", "--persona", default=None, help="Reviewer: staff, pirate, chef, sre, genz or auditor (part of a name works too).")
    parser.add_argument("-m", "--model", default=None, help="Gemini model to try first.")
    parser.add_argument("--list", action="store_true", help="List available personas and exit.")
    parser.add_argument("--commit", action="store_true", help="Offer to commit using the suggested message.")
    args = parser.parse_args()

    if args.list:
        for pid, p in PERSONAS.items():
            console.print(f"[bold]{pid:<8}[/bold] {p['name']}")
        return

    persona_id = find_persona(args.persona or args.persona_pos or "staff")
    persona = PERSONAS[persona_id]["name"]

    if not resolve_api_key():
        console.print("[bold red]Error:[/] no Gemini API key found.")
        console.print("macOS/Linux: [cyan]export GEMINI_API_KEY='your_key'[/]")
        console.print("Windows:     [cyan]setx GEMINI_API_KEY \"your_key\"[/]  (then open a new terminal)")
        sys.exit(1)

    with console.status("[cyan]Reading git diff…[/]"):
        diff, staged = get_git_diff()

    if not diff:
        console.print("[yellow]No changes found.[/] Edit some files (and `git add` them), then try again.")
        return
    if not staged:
        console.print("[dim]No staged changes, so reviewing unstaged ones instead.[/]")

    stats = diff_stats(diff)
    console.print(f"[dim]{stats.file_count} file(s) · [green]{stats.added} added[/green] · [red]{stats.removed} removed[/red][/dim]")

    try:
        with console.status(f"[magenta]{persona} is reading your code…[/]"):
            result = analyze_diff(diff, persona_id, preferred_model=args.model)
    except CommitRoastError as e:
        console.print(f"[bold red]Error:[/] {e}")
        sys.exit(1)

    r = result.report
    c = colour_for(r.risk_score)
    console.print()
    console.print(Panel(r.roast, title=persona, subtitle=f"risk {r.risk_score}/10", border_style=c))
    console.print(Panel(r.summary, title="What actually changed", border_style="cyan"))

    table = Table(title="Real problems to fix", show_header=False, border_style="yellow", expand=True)
    for concern in r.concerns:
        table.add_row(f"[red]![/red] {concern}")
    console.print(table)
    console.print(Panel(f"[bold green]{r.conventional_commit}[/]", title="Suggested commit message", border_style="green"))
    if result.truncated:
        console.print("[dim]Note: the diff was large, so only the first 20,000 characters were reviewed.[/]")
    console.print(f"[dim]Model: {result.model}[/]\n")

    if args.commit:
        if not staged:
            console.print("[yellow]Nothing is staged, so there's nothing to commit. Run `git add` first.[/]")
        elif Confirm.ask(f"Commit with [green]{r.conventional_commit}[/]?", default=False):
            out = run_git("commit", "-m", r.conventional_commit)
            console.print(out.stdout or out.stderr)


if __name__ == "__main__":
    main()
