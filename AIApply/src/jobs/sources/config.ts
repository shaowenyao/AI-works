/**
 * Companies to scan for new postings. Add entries here for the companies you're
 * interested in. `boardId` is the identifier from that company's public job
 * board URL (see the comment on each fetcher for how to find it).
 *
 * Set `priority: true` for companies where a tailored resume is obviously
 * worth the effort (e.g. Meta) — priority jobs sort to the top of the list
 * and are badged in the UI, so you can tell at a glance which "Generate
 * Resume" clicks are worth your time vs. some unknown small company.
 */
export interface WatchedCompany {
  name: string;
  boardId: string;
  priority?: boolean;
}

export const watchedCompanies = {
  greenhouse: [
    // { name: "Acme Corp", boardId: "acme" },
  ] as WatchedCompany[],
  lever: [
    // { name: "Acme Corp", boardId: "acme" },
  ] as WatchedCompany[],
  ashby: [
    // { name: "Acme Corp", boardId: "acme" },
  ] as WatchedCompany[],
  smartrecruiters: [
    // { name: "Acme Corp", boardId: "acme" },
  ] as WatchedCompany[],
  bamboohr: [
    // { name: "Acme Corp", boardId: "acme" },
  ] as WatchedCompany[],
};
