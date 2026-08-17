/**
 * Nigeria's 6 geopolitical zones and their constituent states (36 states + FCT).
 * This is standard, stable geography — not something that changes per
 * competition cycle, so it's seeded once and reused across every cycle.
 */
export const ZONES_AND_STATES: Record<string, string[]> = {
  "North Central": [
    "Benue",
    "Kogi",
    "Kwara",
    "Nasarawa",
    "Niger",
    "Plateau",
    "FCT",
  ],
  "North East": [
    "Adamawa",
    "Bauchi",
    "Borno",
    "Gombe",
    "Taraba",
    "Yobe",
  ],
  "North West": [
    "Jigawa",
    "Kaduna",
    "Kano",
    "Katsina",
    "Kebbi",
    "Sokoto",
    "Zamfara",
  ],
  "South East": [
    "Abia",
    "Anambra",
    "Ebonyi",
    "Enugu",
    "Imo",
  ],
  "South South": [
    "Akwa Ibom",
    "Bayelsa",
    "Cross River",
    "Delta",
    "Edo",
    "Rivers",
  ],
  "South West": [
    "Ekiti",
    "Lagos",
    "Ogun",
    "Ondo",
    "Osun",
    "Oyo",
  ],
};
