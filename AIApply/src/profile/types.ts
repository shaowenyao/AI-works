export interface WorkExperience {
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  bullets: string[];
}

export interface Education {
  institution: string;
  degree: string;
  graduationDate: string;
}

export interface Profile {
  name: string;
  email: string;
  phone: string;
  linkedinUrl?: string;
  location?: string;
  summary: string;
  workExperience: WorkExperience[];
  education: Education[];
  skills: string[];
}
