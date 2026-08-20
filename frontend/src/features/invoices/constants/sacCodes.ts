export interface SacPreset {
  code: string;
  category: string;
  description: string;
  defaultGstRate: number;
}

export const COMMON_FREELANCE_SAC_CODES: SacPreset[] = [
  {
    code: '998314',
    category: 'IT & Software',
    description: 'Information Technology (IT) Design & Development Services',
    defaultGstRate: 18,
  },
  {
    code: '998313',
    category: 'IT & Cloud',
    description: 'IT Infrastructure, Cloud & Web Hosting Services',
    defaultGstRate: 18,
  },
  {
    code: '998311',
    category: 'Consulting',
    description: 'Management & Information Technology Consulting Services',
    defaultGstRate: 18,
  },
  {
    code: '998361',
    category: 'Design & Marketing',
    description: 'Advertising, UI/UX Design & Creative Services',
    defaultGstRate: 18,
  },
  {
    code: '998439',
    category: 'Media & Content',
    description: 'Digital Content, Video Editing & Copywriting Services',
    defaultGstRate: 18,
  },
  {
    code: '998315',
    category: 'Maintenance',
    description: 'Software Maintenance, Support & Bug Fixing Services',
    defaultGstRate: 18,
  },
  {
    code: '998399',
    category: 'General Professional',
    description: 'Other Professional, Scientific & Technical Services',
    defaultGstRate: 18,
  },
];
