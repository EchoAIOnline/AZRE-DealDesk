// --- CONFIGURATION ---
export const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyEUeEVnaGj1p-_4qTuHX63i4QekUz6j2AgBKdNpvB8RVq7TojhduR_LILl34rBpOtn/exec";
export const GOOGLE_MAPS_API_KEY = "AIzaSyASuyXz6R-QrKgqeiaHF_JYfmF2c88agy0"; 

// --- STATUS CONSTANTS ---
export const POTENTIAL_STATUSES = [
  'No Offer Made Yet', 
  'Monitoring Pending Status Before Offer', 
  'Requires A Buyers Agent', 
  'Made Verbal Offer On Property', 
  'Made Written Offer On Property', 
  'Monitoring Pending Status After Offer', 
  'Monitoring Offer After Seller Declined', 
  'Analyzing'
];

export const UNDER_CONTRACT_STATUSES = [
  'Seller Accepted Offer', 
  'Agent Sending Contract', 
  'Deal Under Contract'
];

export const COUNTER_STATUSES = [
  'Seller Counter-Offered'
];

export const DECLINED_STATUSES = [
  'Listing Removed - Now Off Market', 
  'Offer Declined', 
  'Offer Declined and Sold', 
  'Sold To Another Investor', 
  'Deal Canceled', 
  'Priced Too High To Buy', 
  'No Longer Interested In Buying',
  'Declined',
  'Deal No Longer Available'
];

export const CLOSED_STATUSES = [
  'Deal Successfully Closed'
];

export const JV_PIPELINE_STATUSES = [
  'Available',
  'No Longer Available'
];

export const OFFER_DECISIONS = [
    ...POTENTIAL_STATUSES,
    ...UNDER_CONTRACT_STATUSES,
    ...DECLINED_STATUSES,
    ...CLOSED_STATUSES
];

export const BUYER_STATUS_TABS = [
  { id: 'All Buyers', label: 'All Buyers', activeColorClass: 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400' },
  { id: 'New Lead', label: 'New Lead', activeColorClass: 'text-yellow-600 dark:text-yellow-400 border-yellow-600 dark:border-yellow-400' },
  { id: 'Vetted Buyer', label: 'Vetted Buyers', activeColorClass: 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400' },
  { id: 'Repeat Buyer', label: 'Repeat Buyers', activeColorClass: 'text-green-600 dark:text-green-400 border-green-600 dark:border-green-400' },
  { id: 'VIP Buyer', label: 'VIP Buyers', activeColorClass: 'text-purple-600 dark:text-purple-400 border-purple-600 dark:border-purple-400' },
  { id: 'Deactivated', label: 'Deactivated Buyers', activeColorClass: 'text-red-600 dark:text-red-400 border-red-600 dark:border-red-400' }
];

export const AGENT_STATUS_TABS = [
  { id: 'All Agents', label: 'All Agents', activeColorClass: 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400' },
  { id: 'Contacted', label: 'Contacted Already', activeColorClass: 'text-orange-600 dark:text-orange-400 border-orange-600 dark:border-orange-400' },
  { id: 'Investor Friendly', label: 'Investor Friendly', activeColorClass: 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400' },
  { id: 'Agreed to Send', label: 'Agreed to Send Deals', activeColorClass: 'text-purple-600 dark:text-purple-400 border-purple-600 dark:border-purple-400' },
  { id: 'Closed Deals', label: 'Closed With AZRE', activeColorClass: 'text-green-600 dark:text-green-400 border-green-600 dark:border-green-400' }
];

export const WHOLESALER_STATUS_TABS = [
  { id: 'All Wholesalers', label: 'All Wholesalers', activeColorClass: 'text-orange-600 dark:text-orange-400 border-orange-600 dark:border-orange-400' },
  { id: 'New', label: 'New Lead', activeColorClass: 'text-blue-600 dark:text-blue-400 border-blue-600 dark:border-blue-400' },
  { id: 'Vetted', label: 'Vetted', activeColorClass: 'text-green-600 dark:text-green-400 border-green-600 dark:border-green-400' },
  { id: 'JV Partner', label: 'JV Partner', activeColorClass: 'text-purple-600 dark:text-purple-400 border-purple-600 dark:border-purple-400' },
  { id: 'Blacklisted', label: 'Blacklisted', activeColorClass: 'text-red-600 dark:text-red-400 border-red-600 dark:border-red-400' }
];

export const SUB_MARKETS = [
  'Acworth', 'Alpharetta', 'Atlanta', 'Austell', 'Brookhaven', 'Buford', 
  'Canton', 'Cartersville', 'Chamblee', 'College Park', 'Conyers', 'Cumming', 
  'Decatur', 'Doraville', 'Douglasville', 'Duluth', 'Dunwoody', 'East Point', 
  'Fairburn', 'Fayetteville', 'Forest Park', 'Grayson', 'Hapeville', 
  'Johns Creek', 'Jonesboro', 'Kennesaw', 'Lawrenceville', 'Lilburn', 
  'Mableton', 'Marietta', 'McDonough', 'Milton', 'Morrow', 'Newnan', 
  'Norcross', 'Peachtree City', 'Peachtree Corners', 'Powder Springs', 
  'Riverdale', 'Roswell', 'Sandy Springs', 'Smyrna', 'Stone Mountain'
];

export const COUNTIES = [
  'Barrow County',
  'Bartow County',
  'Butts County',
  'Carroll County',
  'Cherokee County',
  'Clayton County',
  'Cobb County',
  'Coweta County',
  'Dawson County',
  'DeKalb County',
  'Douglas County',
  'Fayette County',
  'Forsyth County',
  'Fulton County',
  'Gwinnett County',
  'Haralson County',
  'Heard County',
  'Henry County',
  'Jasper County',
  'Lamar County',
  'Lumpkin County',
  'Meriwether County',
  'Morgan County',
  'Newton County',
  'Paulding County',
  'Pickens County',
  'Pike County',
  'Rockdale County',
  'Spalding County',
  'Walton County'
];

export const ATLANTA_NEIGHBORHOODS = [
  // NPU-A
  'Chastain Park', 'Kingswood', 'Margaret Mitchell', 'Mt. Paran Parkway', 'Mt. Paran/Northside', 'Paces', 'Pleasant Hill', 'Randall Mill', 'Tuxedo Park', 'West Paces Ferry/Northside', 'Whitewater Creek',
  // NPU-B
  'Buckhead Forest', 'Buckhead Village', 'East Chastain Park', 'Garden Hills', 'Lenox', 'Lindbergh/Morosgo', 'North Buckhead', 'Peachtree Heights East', 'Peachtree Heights West', 'Peachtree Hills', 'Peachtree Park', 'Pine Hills', 'Ridgedale Park', 'South Tuxedo Park',
  // NPU-C
  'Arden/Habersham', 'Argonne Forest', 'Brandon', 'Castlewood', 'Channing Valley', 'Collier Hills', 'Collier Hills North', 'Colonial Homes', 'Cross Creek', 'Fernleaf', 'Hanover West', 'Memorial Park', 'Peachtree Battle Alliance', 'Ridgewood Heights', 'Springlake', 'Wesley Battle', 'Westminster/Milar', 'Westover Plantation', 'Wildwood (NPU-C)', 'Woodfield', 'Wyngate',
  // NPU-D
  'Berkeley Park', 'Blandtown', 'Bolton', 'Hills Park', 'Riverside', 'Underwood Hills', 'Whittier Mill Village',
  // NPU-E
  'Ansley Park', 'Ardmore', 'Atlantic Station', 'Brookwood', 'Brookwood Hills', 'Georgia Tech', 'Home Park', 'Loring Heights', 'Marietta Street Artery', 'Midtown', 'Sherwood Forest',
  // NPU-F
  'Atkins Park', 'Lindridge/Martin Manor', 'Morningside/Lenox Park', 'Piedmont Heights', 'Virginia Highland',
  // NPU-G
  'Almond Park', 'Atlanta Industrial Park', 'Bolton Hills', 'Brookview Heights', 'Carey Park', 'Carver Hills', 'Chattahoochee', 'English Park', 'Lincoln Homes', 'Monroe Heights', 'Rockdale', 'Scotts Crossing', 'West Highlands',
  // NPU-H
  'Adamsville', 'Baker Hills', 'Bakers Ferry', 'Bankhead Courts', 'Bankhead/Bolton', 'Boulder Park', 'Carroll Heights', 'Fairburn Heights', 'Fairburn Road/Wisteria Lane', 'Fairburn Mays', 'Mays', 'Oakcliff', 'Old Gordon', 'Ridgecrest Forest', 'Wildwood (NPU-H)', 'Wilson Mill Meadows', 'Wisteria Gardens',
  // NPU-I
  'Audobon Forest', 'Audobon Forest West', 'Beecher Hills', 'Cascade Heights', 'Chalet Woods', 'Collier Heights', 'East Ardley Road', 'Florida Heights', 'Green Acres Valley', 'Green Forest Acres', 'Harland Terrace', 'Horseshoe Community', 'Ivan Hill', 'Magnum Manor', 'Peyton Forest', 'West Manor', 'Westhaven', 'Westwood Terrace',
  // NPU-J
  'Center Hill', 'Dixie Hills', 'Grove Park', 'Harvel Homes Community', 'Penelope Neighbors', 'West Lake',
  // NPU-K
  'Bankhead', 'Hunter Hills', 'Knight Park/Howell Station', 'Mozley Park', 'Washington Park',
  // NPU-L
  'English Avenue', 'Vine City',
  // NPU-M
  'Castleberry Hill', 'Downtown', 'Old Fourth Ward', 'Sweet Auburn',
  // NPU-N
  'Cabbagetown', 'Candler Park', 'Druid Hills', 'Inman Park', 'Lake Clair', 'Poncey-Highland', 'Reynoldstown',
  // NPU-O
  'East Lake', 'Edgewood', 'Kirkwood', 'The Villages at East Lake',
  // NPU-P
  'Arlington Estates', 'Ashley Courts', 'Ben Hill', 'Ben Hill Acres', 'Ben Hill Forest', 'Ben Hill Pines', 'Ben Hill Terrace', 'Brentwood', 'Briar Glen', 'Butner/Tell', 'Cascade Green', 'Deerwood', 'Elmco Estates', 'Fairburn', 'Fairburn Tell', 'Fairway Acres', 'Greenbriar Village', 'Heritage Valley', 'Huntington', 'Kings Forest', 'Lake Estates', 'Meadowbrook Forest', 'Mellwood', 'Mt. Gilead Woods', 'Niskey Cove', 'Niskey Lake', 'Old Fairburn Village', 'Princeton Lakes', 'Rue Royal', 'Sandlewood Estates', 'Tampa Park', 'Wildwood Forest',
  // NPU-Q
  'Midwest Cascade', 'Regency Trace',
  // NPU-R
  'Adams Park', 'Campbellton Road', 'Fort Valley', 'Greenbriar', 'Laurens Valley', 'Pamond Park', 'Southwest',
  // NPU-S
  'Bush Mountain', 'Cascade Avenue/Road', 'Fort McPherson', 'Oakland City', 'Venetian Hills',
  // NPU-T
  'Ashview Heights', 'Atlanta University Center', 'Harris Chiles', 'Just Us', 'The Villages at Castleberry Hill', 'West End', 'Westview',
  // NPU-V
  'Adair Park', 'Capitol Gateway', 'Mechanicsville', 'Peoplestown', 'Pittsburgh', 'Summerhill',
  // NPU-W
  'Benteen Park', 'Boulevard Heights', 'Custer/McDonough/Guice', 'East Atlanta', 'Grant Park', 'Oakland', 'Ormewood Park', 'State Facility', 'Woodland Hills',
  // NPU-X
  'Capitol View', 'Capitol View Manor', 'Hammond Park', 'Perkerson', 'Sylvan Hills',
  // NPU-Y
  'Amal Heights', 'Betmar LaVilla', 'Chosewood Park', 'Englewood Manor', 'High Point', 'Joyland', 'Lakewood Heights', 'South Atlanta', 'The Villages at Carver',
  // NPU-Z
  'Blair Villa/Poole Creek', 'Browns Mill Park', 'Glenrose Heights', 'Lakewood', 'Leila Valley', 'Norwood Manor', 'Orchard Knob', 'Polar Rock', 'Rebel Valley Forest', 'Rosedale Heights', 'South River Gardens', 'Swallow Circle/Baywood', 'Thomasville Heights'
].sort();