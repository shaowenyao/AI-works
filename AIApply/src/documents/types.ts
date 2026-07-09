import type { WorkExperience } from "../profile/types.js";

export interface TailoredContent {
  summary: string;
  workExperience: WorkExperience[];
  coverLetterBody: string;
}
