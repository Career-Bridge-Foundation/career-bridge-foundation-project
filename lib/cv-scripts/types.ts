export type CvScriptScope = 'simulation' | 'discipline_summary';

// Shape persisted in candidate_cv_scripts.formats. cv_bullet is only
// populated for scope=simulation; the rest only for scope=discipline_summary.
export type CvScriptFormats = {
  cv_bullet?: string;
  cv_summary?: string;
  linkedin_project?: { title: string; description: string; url: string };
  linkedin_about?: string;
};
