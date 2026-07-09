export interface JobPosting {
  company: string;
  title: string;
  url: string;
  source: "greenhouse" | "lever" | "ashby" | "smartrecruiters" | "bamboohr";
  description?: string;
  priority?: boolean;
}
