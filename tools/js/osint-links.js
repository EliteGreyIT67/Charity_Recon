/**
 * Pure OSINT link section builder. No DOM. Safe for unit tests.
 */

export function normalizeInputs(inputs = {}) {
  const orgName = (inputs.orgName || '').trim();
  const personName = (inputs.personName || '').trim();
  const orgEin = (inputs.orgEin || '').trim();
  const location = (inputs.location || '').trim();
  const domainName = (inputs.domainName || '').trim();
  const socialHandle = (inputs.socialHandle || '').trim();
  const selectedState = (inputs.selectedState || '').trim();

  return {
    orgName,
    personName,
    orgEin,
    location,
    selectedState,
    encodedOrgName: encodeURIComponent(orgName),
    plusEncodedOrgName: orgName.replace(/\s/g, '+'),
    encodedPersonName: encodeURIComponent(personName),
    encodedLocation: encodeURIComponent(location),
    einWithoutHyphen: orgEin.replace(/-/g, ''),
    locationQuery: location ? ` "${encodeURIComponent(location)}"` : '',
    domain: domainName.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, ''),
    handle: socialHandle.replace(/^@/, ''),
  };
}

/**
 * @param {object} inputs - raw form values
 * @param {{ states?: object, stateResources?: object, stateAnimalWelfareResources?: object }} stateData
 * @returns {Array<{id:string,title:string,icon:string,isOpen:boolean,links:Array<{name:string,url:string}>}>}
 */
export function buildLinkSections(inputs, stateData = {}) {
  const ctx = normalizeInputs(inputs);
  const {
    orgName, personName, orgEin, location, selectedState,
    encodedOrgName, plusEncodedOrgName, encodedPersonName, encodedLocation,
    einWithoutHyphen, locationQuery, domain, handle,
  } = ctx;

  const states = stateData.states || {};
  const stateResources = stateData.stateResources || {};
  const stateAnimalWelfareResources = stateData.stateAnimalWelfareResources || {};
  const stateLabel = selectedState && states[selectedState] ? states[selectedState] : selectedState;

  const sections = [];

  if (selectedState && stateAnimalWelfareResources[selectedState]?.length) {
    sections.push({
      id: 'state-animal',
      title: `${stateLabel} Animal Welfare`,
      icon: 'shield-plus',
      isOpen: true,
      links: stateAnimalWelfareResources[selectedState].map((r) => ({ name: r.n, url: r.u })),
    });
  }

  if (selectedState && stateResources[selectedState]?.length) {
    sections.push({
      id: 'state',
      title: `${stateLabel} State-Level`,
      icon: 'building-2',
      isOpen: true,
      links: stateResources[selectedState].map((r) => ({ name: r.n, url: r.u })),
    });
  }

  sections.push({
    id: 'financial',
    title: 'Federal Financial & Legal',
    icon: 'landmark',
    isOpen: true,
    links: [
      { name: 'IRS Tax Exempt Org Search', url: 'https://apps.irs.gov/app/eos/' },
      { name: 'USDA APHIS Public Search Tool', url: 'https://aphis.my.site.com/PublicSearchTool/s/' },
      {
        name: 'ProPublica Nonprofit Explorer',
        url: orgEin
          ? `https://projects.propublica.org/nonprofits/organizations/${einWithoutHyphen}`
          : `https://projects.propublica.org/nonprofits/search?q=${plusEncodedOrgName}`,
      },
      { name: 'Candid (GuideStar)', url: `https://candid.org/search?q=${orgEin || encodedOrgName}` },
      { name: 'OpenCorporates', url: `https://opencorporates.com/companies?q=${encodedOrgName}` },
    ],
  });

  sections.push({
    id: 'news',
    title: 'News & Public Perception',
    icon: 'newspaper',
    isOpen: false,
    links: [
      { name: 'Google News', url: `https://www.google.com/search?q=%22${encodedOrgName}%22${locationQuery}&tbm=nws` },
      { name: 'Google Reviews Search', url: `https://www.google.com/search?q=%22${encodedOrgName}%22${locationQuery}+reviews` },
      { name: 'Reddit Search', url: `https://www.reddit.com/search/?q=%22${encodedOrgName}%22${locationQuery}` },
      { name: 'Charity Navigator', url: `https://www.charitynavigator.org/search?q=${orgEin || encodedOrgName}` },
      { name: 'CharityWatch', url: `https://www.charitywatch.org/search?q=${encodedOrgName}` },
      { name: 'GreatNonprofits Reviews', url: `https://greatnonprofits.org/search?q=${encodedOrgName}` },
      {
        name: 'Better Business Bureau',
        url: `https://www.bbb.org/search?find_country=USA&find_text=${encodedOrgName}${location ? '&find_loc=' + encodedLocation : ''}`,
      },
    ],
  });

  if (personName) {
    sections.push({
      id: 'personnel',
      title: `Personnel: ${personName}`,
      icon: 'user-check',
      isOpen: true,
      links: [
        {
          name: `Google News: "${personName}" & "${orgName}"`,
          url: `https://www.google.com/search?q=%22${encodedPersonName}%22+%22${encodedOrgName}%22&tbm=nws`,
        },
        {
          name: `LinkedIn: "${personName}" & "${orgName}"`,
          url: `https://www.linkedin.com/search/results/all/?keywords=%22${encodedPersonName}%22%20%22${encodedOrgName}%22`,
        },
        { name: `Google Scholar: ${personName}`, url: `https://scholar.google.com/scholar?q=${encodedPersonName}` },
      ],
    });
  }

  const onlineLinks = [
    { name: 'Wikipedia', url: `https://en.wikipedia.org/w/index.php?search=${encodedOrgName}` },
    { name: 'Facebook', url: `https://www.facebook.com/search/top/?q=${encodedOrgName}${locationQuery}` },
    { name: 'Instagram tag search', url: `https://www.instagram.com/explore/tags/${orgName.replace(/\s+/g, '').toLowerCase()}/` },
    { name: 'X (Twitter) Search', url: `https://twitter.com/search?q=${encodedOrgName}&src=typed_query` },
    { name: 'TikTok Search', url: `https://www.tiktok.com/search?q=${encodedOrgName}` },
    { name: 'LinkedIn Org Search', url: `https://www.linkedin.com/search/results/all/?keywords=${encodedOrgName}` },
    { name: 'YouTube', url: `https://www.youtube.com/results?search_query=${encodedOrgName}` },
  ];
  if (domain) {
    onlineLinks.push(
      { name: 'Internet Archive (Wayback)', url: `https://web.archive.org/web/*/${domain}` },
      { name: 'Whois Lookup', url: `https://whois.domaintools.com/${domain}` },
      { name: 'SSL Labs Test', url: `https://www.ssllabs.com/ssltest/analyze.html?d=${domain}` },
      { name: 'ViewDNS IP History', url: `https://viewdns.info/iphistory/?domain=${domain}` },
    );
  }
  if (handle) {
    onlineLinks.push(
      { name: `X Handle (@${handle})`, url: `https://twitter.com/${handle}` },
      { name: `Facebook /${handle}`, url: `https://www.facebook.com/${handle}` },
      { name: `Instagram @${handle}`, url: `https://www.instagram.com/${handle}` },
    );
  }
  sections.push({ id: 'online', title: 'Online Presence', icon: 'globe-2', links: onlineLinks, isOpen: false });

  if (handle) {
    sections.push({
      id: 'social-deep',
      title: 'Social Media Deep Dive',
      icon: 'users',
      isOpen: false,
      links: [
        { name: `Check Usernames (@${handle})`, url: `https://instantusername.com/#/?query=${handle}` },
        { name: 'Google Reverse Image Search', url: 'https://images.google.com/' },
        { name: 'TinEye Reverse Image Search', url: 'https://tineye.com/' },
      ],
    });
  }

  const legalLinks = [
    { name: 'PACER (Federal Courts)', url: 'https://pacer.uscourts.gov/' },
    { name: `CourtListener: "${orgName}"`, url: `https://www.courtlistener.com/?q=%22${encodedOrgName}%22` },
    { name: 'Google Litigation Search', url: `https://www.google.com/search?q=%22${encodedOrgName}%22+litigation+OR+lawsuit` },
  ];
  if (personName) {
    legalLinks.push({
      name: `Court records: "${personName}" & "${orgName}"`,
      url: `https://www.google.com/search?q=%22${encodedPersonName}%22+%22${encodedOrgName}%22+court+records`,
    });
  }
  if (location) {
    legalLinks.push({
      name: `Local court records (${location})`,
      url: `https://www.google.com/search?q=${plusEncodedOrgName}+court+records+${encodedLocation.replace(/%20/g, '+')}`,
    });
  }
  sections.push({ id: 'legal', title: 'Legal & Court Records', icon: 'gavel', isOpen: false, links: legalLinks });

  if (domain) {
    sections.push({
      id: 'advanced',
      title: 'Advanced & Technical',
      icon: 'shield-check',
      isOpen: false,
      links: [
        { name: 'DNS Dumpster', url: 'https://dnsdumpster.com/' },
        { name: 'crt.sh Certificate Search', url: `https://crt.sh/?q=${domain}` },
        { name: 'BuiltWith Technology Profile', url: `https://builtwith.com/${domain}` },
        { name: 'SpyOnWeb Analytics Search', url: `https://spyonweb.com/${domain}` },
        { name: 'Google Filetype Search (PDF)', url: `https://www.google.com/search?q=site%3A${domain}+filetype%3Apdf` },
        { name: 'Have I Been Pwned', url: 'https://haveibeenpwned.com/' },
      ],
    });
  }

  return sections;
}

/** @returns {{ok:true,data:object}|{ok:false,error:string}} */
export function validateStateData(data) {
  if (!data || typeof data !== 'object') return { ok: false, error: 'State data is not an object' };
  if (!data.states || typeof data.states !== 'object' || !Object.keys(data.states).length) {
    return { ok: false, error: 'state_data.json missing non-empty "states"' };
  }
  if (!data.stateResources || typeof data.stateResources !== 'object') {
    return { ok: false, error: 'state_data.json missing "stateResources"' };
  }
  if (!data.stateAnimalWelfareResources || typeof data.stateAnimalWelfareResources !== 'object') {
    return { ok: false, error: 'state_data.json missing "stateAnimalWelfareResources"' };
  }
  return { ok: true, data };
}
