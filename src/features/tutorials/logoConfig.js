/**
 * Centralized logo configurations and lookup keywords for rules & regulations tutorials.
 */
export const LOGO_KEYWORD_MAPPINGS = [
  {
    logo: '/logos/no_customer_vehicle_logo.png',
    keywords: ['customer vehicle', 'personal use', 'material']
  },
  {
    logo: '/logos/no_drinking_logo.png',
    keywords: ['drinking', 'alcohol', 'sober', 'liquor']
  },
  {
    logo: '/logos/no_under_influence_logo.png',
    keywords: ['influence', 'drugs', 'narcotics']
  },
  {
    logo: '/logos/no_fighting_logo.png',
    keywords: ['fight', 'violence', 'abuse', 'assault', 'harassment', 'physical conflict']
  },
  {
    logo: '/logos/no_cash_logo.png',
    keywords: ['cash', 'upi', 'payment', 'financial fraud', 'data']
  },
  {
    logo: '/logos/no_favoritism_logo.png',
    keywords: ['friendship', 'relations', 'secret', 'advantage', 'preferential treatment']
  }
];

/**
 * Gets the logo path based on the rule title matching the mappings.
 * Falls back to the standard PowerPod logo.
 * 
 * @param {string} title - The rule title to match keywords against
 * @param {number} slideIndex - The slide index (0-indexed). Only the first slide gets a custom logo.
 * @returns {string} The path to the logo image
 */
export function getRuleLogo(title = '', slideIndex = 0) {
  const lowerTitle = title.toLowerCase();
  const match = LOGO_KEYWORD_MAPPINGS.find(mapping =>
    mapping.keywords.some(keyword => lowerTitle.includes(keyword))
  );
  return match ? match.logo : '/logos/powerpod-logo.svg';
}
