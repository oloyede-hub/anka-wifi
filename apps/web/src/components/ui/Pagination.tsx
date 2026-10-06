import { Button } from "./Button";
export function Pagination({
  page,
  count,
  hasNext,
  busy,
  change,
  total,
  pageSize = 10,
  maxPage = Infinity,
}: {
  page: number;
  count: number;
  hasNext: boolean;
  busy: boolean;
  change: (page: number) => void;
  total?: number;
  pageSize?: number;
  maxPage?: number;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-xs text-muted">
      <p>
        {count
          ? `Showing ${page * pageSize + 1}–${page * pageSize + count}${total !== undefined ? ` of ${total}` : ""}`
          : "No results"}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="md"

          onClick={() => change(page - 1)}
          disabled={busy || page === 0}
        >
          Previous
        </Button>
        <span>Page {page + 1}</span>
        <Button
          variant="secondary"
          size="md"

          onClick={() => change(page + 1)}
          disabled={busy || !hasNext || page >= maxPage}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
