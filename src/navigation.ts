import { getPermalink } from './utils/permalinks';

const LINKEDIN = 'https://www.linkedin.com/in/snehankekre/';
const GITHUB = 'https://github.com/snehankekre';
const EMAIL = 'mailto:snehan.minerva@gmail.com';

export const headerData = {
  links: [
    { text: 'About', href: getPermalink('/#about') },
    { text: 'Experience', href: getPermalink('/#experience') },
    { text: 'Portfolio', href: getPermalink('/#portfolio') },
    { text: 'Diving', href: getPermalink('/#diving') },
  ],
  actions: [{ text: 'Résumé', href: '/Snehan_Kekre_CV.pdf', target: '_blank' }],
};

export const footerData = {
  links: [],
  secondaryLinks: [],
  socialLinks: [
    { ariaLabel: 'LinkedIn', icon: 'tabler:brand-linkedin', href: LINKEDIN },
    { ariaLabel: 'GitHub', icon: 'tabler:brand-github', href: GITHUB },
    { ariaLabel: 'Email', icon: 'tabler:mail', href: EMAIL },
  ],
  footNote: `
    © ${new Date().getFullYear()} Snehan Kekre · Built with <a class="text-blue-600 underline dark:text-muted" href="https://astro.build">Astro</a>.
  `,
};
