export const trustedHosts = [
  "kdca.go.kr",
  "nip.kdca.go.kr",
  "nhis.or.kr",
  "hi.nhis.or.kr",
  "childcare.go.kr",
  "mfds.go.kr",
  "foodsafetykorea.go.kr",
  "dietary4u.mfds.go.kr",
  "mohw.go.kr",
  "hira.or.kr",
  "korea.kr",
  "health.kr",
  "kicce.re.kr",
  "repo.kicce.re.kr"
];

export function isTrustedSourceUrl(url) {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return trustedHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export function inferTrustGrade(sourceInstitution = "", url = "") {
  const label = `${sourceInstitution} ${url}`;

  if (/질병관리청|보건복지부|식품의약품안전처|국민건강보험공단/.test(label)) {
    return "A+";
  }

  if (/공단|공공기관|센터|포털|정부/.test(label)) {
    return "A";
  }

  return "B";
}
