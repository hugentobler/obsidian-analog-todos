/**
 * Page type definitions
 */

export type PageType = "now" | "next";

export const PAGE_CONFIG: Record<
	PageType,
	{ filename: string; displayName: string }
> = {
	now: { filename: "Now.md", displayName: "Now" },
	next: { filename: "Next.md", displayName: "Next" },
};
