// Fun facts indexed by country code, with multiple options per country
const facts: Record<string, string[]> = {
  US: [
    'Over 40% of the world\'s internet traffic passes through Virginia\'s "Data Center Alley" in Ashburn.',
    'The first message ever sent over the internet was "LO" — the system crashed before completing "LOGIN" in 1969.',
    'The US has more than 2,800 data centers, more than any other country.',
    'New York City alone has over 285 miles of fiber optic cable running beneath its streets.',
    'The internet backbone in the US carries over 4.8 exabytes of data daily.',
    'Silicon Valley was originally known for its fruit orchards, not tech companies.',
    'Alaska is both the westernmost and easternmost US state (the Aleutian Islands cross the 180th meridian).',
  ],
  CA: [
    'Canada has the longest coastline of any country — over 202,080 km.',
    'The Trans-Canada Highway is one of the longest national highways in the world at 7,821 km.',
    'Montréal hosts one of the largest internet exchange points in North America (QIX).',
    'Canada has more lakes than every other country combined.',
    'The Canadian internet backbone stretches over 4,000 km from coast to coast.',
  ],
  GB: [
    'London is home to the LINX exchange, one of the world\'s largest internet exchange points.',
    'The first website ever created is still online: info.cern.ch, hosted at CERN (built by a Brit).',
    'Cornwall, England is where many transatlantic fiber optic cables make landfall.',
    'The UK processes more internet traffic per capita than almost any other nation.',
    'Big Ben is actually the name of the bell, not the tower (which is the Elizabeth Tower).',
  ],
  DE: [
    'Frankfurt\'s DE-CIX is the world\'s largest internet exchange point by traffic.',
    'Germany has over 50 internet exchange points — more than most countries.',
    'The Autobahn has no universal speed limit, and German data networks are equally fast.',
    'Germany was home to the first printed book (Gutenberg Bible, ~1455).',
    'Berlin has more bridges than Venice — around 960 compared to Venice\'s 400.',
  ],
  NL: [
    'The Amsterdam Internet Exchange (AMS-IX) is one of the world\'s busiest exchange points.',
    'Over 60 submarine cables terminate in the Netherlands.',
    'The Netherlands is below sea level in many areas, yet hosts critical global infrastructure.',
    'The Dutch word "gezellig" has no English translation — it means a warm, convivial atmosphere.',
    'Amsterdam has more bicycles than people — about 881,000 bikes for 821,000 residents.',
  ],
  JP: [
    'Japan has some of the fastest average internet speeds in the world.',
    'Tokyo\'s Otemachi district is the primary interconnection hub for Asia-Pacific networks.',
    'Japan\'s first internet connection was established in 1984 between Tokyo and Keio University.',
    'Japan has over 6,800 islands, but most internet traffic flows through just a few cables.',
    'The Tokyo subway system moves 8.7 million passengers daily — more than most countries\' total population.',
  ],
  SG: [
    'Singapore is one of the most connected countries, with over 20 submarine cable systems.',
    'At just 733 km², Singapore routes traffic for much of Southeast Asia.',
    'Singapore has the world\'s fastest average broadband speed at over 200 Mbps.',
    'Changi Airport has been voted the world\'s best airport for 12 consecutive years.',
  ],
  AU: [
    'Australia is connected to the global internet primarily through submarine cables in Perth and Sydney.',
    'The distance from Sydney to London via fiber optic cable is about 22,000 km.',
    'Australia\'s internet traffic must cross the world\'s largest ocean to reach most destinations.',
    'The Great Barrier Reef is visible from space and stretches over 2,300 km.',
  ],
  BR: [
    'Brazil has the largest internet user base in Latin America with over 180 million users.',
    'São Paulo\'s IX.br is the world\'s largest internet exchange by number of connected networks.',
    'Fortaleza, Brazil is a major landing point for transatlantic submarine cables.',
    'Brazil spans 3 time zones and is the 5th largest country by area.',
  ],
  IN: [
    'India has over 900 million internet users, the second largest online population.',
    'Mumbai and Chennai are India\'s primary submarine cable landing stations.',
    'India\'s internet traffic has grown over 30x in the last decade.',
    'India has 22 officially recognized languages, but most of its code is written in English.',
  ],
  FR: [
    'Marseille is Europe\'s largest submarine cable hub, with over 15 cable systems landing there.',
    'France\'s internet backbone runs along the same routes as its famous TGV high-speed rail.',
    'Paris houses one of Europe\'s densest clusters of data centers.',
    'The Eiffel Tower was originally intended to stand for only 20 years.',
  ],
  KR: [
    'South Korea consistently ranks #1 for average internet speed worldwide.',
    'Over 97% of South Korean households have broadband internet access.',
    'Busan is a major submarine cable landing point connecting Asia to North America.',
    'South Korea\'s gaming culture helped drive its massive investment in internet infrastructure.',
  ],
  SE: [
    'Stockholm\'s Pionen data center is built inside a former nuclear bunker under a mountain.',
    'Sweden\'s Netnod operates the country\'s internet exchange points.',
    'Sweden was one of the first countries to connect to the internet in Europe.',
    'Sweden recycles 99% of its household waste — some is even imported from other countries.',
  ],
  IE: [
    'Ireland hosts European headquarters for Google, Meta, Apple, and Microsoft.',
    'Dublin\'s data centers consume about 18% of Ireland\'s total electricity.',
    'Ireland\'s position makes it a key landing point for transatlantic cables.',
    'Ireland has no native snakes — and never has, even before St. Patrick.',
  ],
}

const fallback = [
  'Every internet packet you send can travel through up to 30 different routers before reaching its destination.',
  'Over 95% of international internet traffic travels through undersea fiber optic cables.',
  'The total length of submarine internet cables exceeds 1.3 million km — enough to circle Earth 33 times.',
  'Light travels through fiber optic cable at about 200,000 km/s — two-thirds the speed of light in a vacuum.',
  'The average webpage makes over 80 HTTP requests to fully load.',
  'Internet traffic doubles approximately every two years.',
  'The first emoticon was used in 1982 by Scott Fahlman: :-)',
  'A single strand of fiber optic cable can carry over 100 terabits per second.',
]

export function getRandomFact(countryCode?: string): string {
  if (countryCode && facts[countryCode]) {
    const pool = facts[countryCode]
    return pool[Math.floor(Math.random() * pool.length)]
  }
  return fallback[Math.floor(Math.random() * fallback.length)]
}
