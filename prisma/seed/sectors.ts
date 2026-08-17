/**
 * The 10 starting sectors. Trades are intentionally left empty here —
 * per your instruction, the super_admin populates trades either one-by-one
 * via the admin UI or via Excel bulk import. This list itself is also
 * just a starting point: Sector.disabled and new Sector rows can both be
 * managed from the admin UI later, it's not cast in stone.
 */
export const SECTORS: string[] = [
  "Building Construction",
  "Hospitality and Tourism",
  "Education and Social Care",
  "Welding and Fabrication",
  "Engineering",
  "Agriculture",
  "Fashion Design, Garment and Apparel",
  "Automobile",
  "Creative Media",
  "ICT",
];
