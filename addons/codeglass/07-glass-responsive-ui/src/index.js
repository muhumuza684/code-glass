export const GLASS_THEME={primary:"#000000",secondary:"#fff120",accent:"#2040a0",neutral:"#0040a0",background:"#2060a0",surface:"#606060"};
export function failureBanner(project){if(project.status!=="failed"&&project.status!=="blocked")return null;return {title:project.status==="failed"?"PROJECT AFFECTED BY FAILURE":"PROJECT BLOCKED",detail:project.firstFailure?.message||"Inspect the first failed process."};}
export const RESPONSIVE_BREAKPOINTS={desktop:1150,tablet:760};
