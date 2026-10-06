// Recharts receives CSS variables from the same theme used by Tailwind controls.
export const chartTheme = {
  palette: [
    "var(--color-chart-primary)",
    "var(--color-chart-success)",
    "var(--color-chart-warning)",
    "var(--color-chart-purple)",
    "var(--color-chart-danger)",
    "var(--color-chart-neutral)",
  ],
  primary: "var(--color-chart-primary)",
  grid: "var(--color-chart-grid)",
  tick: { fill: "var(--color-muted)", fontSize: 11 },
  tooltip: { borderRadius: 10, borderColor: "var(--color-line)", fontSize: 12 },
};
