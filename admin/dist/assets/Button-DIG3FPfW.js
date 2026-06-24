import{j as e,H as g}from"./index-DmgHiO0K.js";const a={primary:"bg-primary-600 text-white hover:bg-primary-700 focus-visible:ring-primary-500 shadow-sm",secondary:"bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 focus-visible:ring-slate-400",ghost:"text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:ring-slate-400",danger:"bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 shadow-sm",success:"bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500 shadow-sm"},i={sm:"h-8 px-3 text-xs gap-1.5",md:"h-10 px-4 text-sm gap-2",lg:"h-11 px-5 text-sm gap-2"};function x({children:o,variant:l="primary",size:d="md",loading:s=!1,disabled:n=!1,icon:r,iconRight:t,className:b="",type:m="button",...h}){const c=n||s;return e.jsxs("button",{type:m,disabled:c,className:`
        inline-flex items-center justify-center rounded-lg font-medium transition-colors
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        dark:focus-visible:ring-offset-slate-900
        disabled:opacity-50 disabled:cursor-not-allowed
        ${a[l]||a.primary}
        ${i[d]||i.md}
        ${b}
      `,...h,children:[s?e.jsx(g,{className:"h-4 w-4 animate-spin","aria-hidden":"true"}):r?e.jsx(r,{className:"h-4 w-4 shrink-0","aria-hidden":"true"}):null,o,!s&&t&&e.jsx(t,{className:"h-4 w-4 shrink-0","aria-hidden":"true"})]})}export{x as B};
