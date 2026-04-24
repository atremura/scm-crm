/**
 * SCM Materials Seed — populates MaterialType + Material for JMO Carpentry.
 *
 * Usage:
 *   npx tsx prisma/seed-materials.ts
 *
 * Idempotent via upsert on (companyId, slug) for MaterialType and (companyId, name) for Material.
 * Safe to re-run when price list is updated.
 *
 * Source data: /Sistemas/prices.json (200 items)
 * Generated: 2026-04-23
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const COMPANY_SLUG = 'jmo';

const materialTypes: { slug: string; name: string; parentSlug: string | null }[] = [
  {
    "slug": "siding",
    "name": "SIDING",
    "parentSlug": null
  },
  {
    "slug": "siding--vinyl-siding",
    "name": "Vinyl Siding",
    "parentSlug": "siding"
  },
  {
    "slug": "siding--hardie-lap",
    "name": "Hardie Lap",
    "parentSlug": "siding"
  },
  {
    "slug": "siding--hardie-panel",
    "name": "Hardie Panel",
    "parentSlug": "siding"
  },
  {
    "slug": "siding--wood-siding",
    "name": "Wood Siding",
    "parentSlug": "siding"
  },
  {
    "slug": "siding--siding-accessories",
    "name": "Siding Accessories",
    "parentSlug": "siding"
  },
  {
    "slug": "siding--hardietrim",
    "name": "HardieTrim",
    "parentSlug": "siding"
  },
  {
    "slug": "siding--pvc-trim-sealed-edge",
    "name": "PVC Trim (Sealed Edge)",
    "parentSlug": "siding"
  },
  {
    "slug": "siding--pvc-trim-specialty",
    "name": "PVC Trim (Specialty)",
    "parentSlug": "siding"
  },
  {
    "slug": "siding--pvc-corners",
    "name": "PVC Corners",
    "parentSlug": "siding"
  },
  {
    "slug": "siding--pvc-mouldings",
    "name": "PVC Mouldings",
    "parentSlug": "siding"
  },
  {
    "slug": "siding--pvc-sheet",
    "name": "PVC Sheet",
    "parentSlug": "siding"
  },
  {
    "slug": "woods-lumber",
    "name": "WOODS / LUMBER",
    "parentSlug": null
  },
  {
    "slug": "woods-lumber--framing-lumber",
    "name": "Framing Lumber",
    "parentSlug": "woods-lumber"
  },
  {
    "slug": "woods-lumber--pressure-treated",
    "name": "Pressure Treated",
    "parentSlug": "woods-lumber"
  },
  {
    "slug": "woods-lumber--plywood",
    "name": "Plywood",
    "parentSlug": "woods-lumber"
  },
  {
    "slug": "woods-lumber--osb",
    "name": "OSB",
    "parentSlug": "woods-lumber"
  },
  {
    "slug": "woods-lumber--board-lumber",
    "name": "Board Lumber",
    "parentSlug": "woods-lumber"
  },
  {
    "slug": "finish-carpentry",
    "name": "FINISH CARPENTRY",
    "parentSlug": null
  },
  {
    "slug": "finish-carpentry--baseboards",
    "name": "Baseboards",
    "parentSlug": "finish-carpentry"
  },
  {
    "slug": "finish-carpentry--crown-molding",
    "name": "Crown Molding",
    "parentSlug": "finish-carpentry"
  },
  {
    "slug": "finish-carpentry--casing",
    "name": "Casing",
    "parentSlug": "finish-carpentry"
  },
  {
    "slug": "finish-carpentry--interior-doors",
    "name": "Interior Doors",
    "parentSlug": "finish-carpentry"
  },
  {
    "slug": "finish-carpentry--door-hardware",
    "name": "Door Hardware",
    "parentSlug": "finish-carpentry"
  },
  {
    "slug": "finish-carpentry--moldings",
    "name": "Moldings",
    "parentSlug": "finish-carpentry"
  },
  {
    "slug": "windows-doors",
    "name": "WINDOWS & DOORS",
    "parentSlug": null
  },
  {
    "slug": "windows-doors--vinyl-windows",
    "name": "Vinyl Windows",
    "parentSlug": "windows-doors"
  },
  {
    "slug": "windows-doors--mid-tier-windows",
    "name": "Mid-Tier Windows",
    "parentSlug": "windows-doors"
  },
  {
    "slug": "windows-doors--entry-doors",
    "name": "Entry Doors",
    "parentSlug": "windows-doors"
  },
  {
    "slug": "windows-doors--patio-doors",
    "name": "Patio Doors",
    "parentSlug": "windows-doors"
  },
  {
    "slug": "windows-doors--storm-doors",
    "name": "Storm Doors",
    "parentSlug": "windows-doors"
  },
  {
    "slug": "windows-doors--exterior-hardware",
    "name": "Exterior Hardware",
    "parentSlug": "windows-doors"
  },
  {
    "slug": "decks-exterior",
    "name": "DECKS & EXTERIOR",
    "parentSlug": null
  },
  {
    "slug": "decks-exterior--composite-decking",
    "name": "Composite Decking",
    "parentSlug": "decks-exterior"
  },
  {
    "slug": "decks-exterior--pt-decking",
    "name": "PT Decking",
    "parentSlug": "decks-exterior"
  },
  {
    "slug": "decks-exterior--railings",
    "name": "Railings",
    "parentSlug": "decks-exterior"
  },
  {
    "slug": "decks-exterior--deck-hardware",
    "name": "Deck Hardware",
    "parentSlug": "decks-exterior"
  },
  {
    "slug": "decks-exterior--gutters",
    "name": "Gutters",
    "parentSlug": "decks-exterior"
  },
  {
    "slug": "insulation-drywall",
    "name": "INSULATION & DRYWALL",
    "parentSlug": null
  },
  {
    "slug": "insulation-drywall--fiberglass-batt",
    "name": "Fiberglass Batt",
    "parentSlug": "insulation-drywall"
  },
  {
    "slug": "insulation-drywall--rigid-foam",
    "name": "Rigid Foam",
    "parentSlug": "insulation-drywall"
  },
  {
    "slug": "insulation-drywall--spray-foam",
    "name": "Spray Foam",
    "parentSlug": "insulation-drywall"
  },
  {
    "slug": "insulation-drywall--drywall",
    "name": "Drywall",
    "parentSlug": "insulation-drywall"
  },
  {
    "slug": "insulation-drywall--drywall-finishing",
    "name": "Drywall Finishing",
    "parentSlug": "insulation-drywall"
  },
  {
    "slug": "insulation-drywall--drywall-fasteners",
    "name": "Drywall Fasteners",
    "parentSlug": "insulation-drywall"
  }
];

const materials: {
  materialTypeSlug: string;
  name: string;
  sku: string | null;
  avgCents: number;
  uom: string;
  wastePercent: number;
  supplier: string | null;
  supplierUrl: string | null;
  notes: string | null;
}[] = [
  {
    "materialTypeSlug": "siding--vinyl-siding",
    "name": "Vinyl Siding - Standard Grade",
    "sku": null,
    "avgCents": 450,
    "uom": "SF",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.peakandvalleyroofing.com/vinyl-siding-cost-per-square-foot-2026-complete-price-breakdown/",
    "notes": "Standard residential grade, material only [range $3.50-$5.50]"
  },
  {
    "materialTypeSlug": "siding--vinyl-siding",
    "name": "Vinyl Siding - Premium Grade",
    "sku": null,
    "avgCents": 800,
    "uom": "SF",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.peakandvalleyroofing.com/vinyl-siding-cost-per-square-foot-2026-complete-price-breakdown/",
    "notes": "Premium grade, better durability and finish [range $6.00-$10.00]"
  },
  {
    "materialTypeSlug": "siding--vinyl-siding",
    "name": "Vinyl Siding - Standard Box (covers ~100 sq ft)",
    "sku": null,
    "avgCents": 2300,
    "uom": "BX",
    "wastePercent": 5,
    "supplier": "ABC Supply",
    "supplierUrl": "https://www.abcsupply.com/products/siding/vinyl-siding/",
    "notes": "Contractor supply, ~100 sq ft per box [range $18.00-$28.00]"
  },
  {
    "materialTypeSlug": "siding--hardie-lap",
    "name": "HardiePlank Lap Siding - Primed (12 ft)",
    "sku": null,
    "avgCents": 1100,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "84 Lumber, Home Depot",
    "supplierUrl": "https://www.jameshardie.com/",
    "notes": "Primed finish, 12 ft length [range $10.00-$12.00]"
  },
  {
    "materialTypeSlug": "siding--hardie-lap",
    "name": "HardiePlank Lap Siding - ColorPlus (12 ft)",
    "sku": null,
    "avgCents": 1450,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "84 Lumber, Beacon",
    "supplierUrl": "https://www.jameshardie.com/",
    "notes": "Factory baked ColorPlus finish [range $13.00-$16.00]"
  },
  {
    "materialTypeSlug": "siding--hardie-panel",
    "name": "HardiePanel Vertical Siding 4x8",
    "sku": null,
    "avgCents": 5500,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "84 Lumber",
    "supplierUrl": "https://www.jameshardie.com/",
    "notes": "5/16 inch, primed, 8-inch OC pattern [range $45.00-$65.00]"
  },
  {
    "materialTypeSlug": "siding--hardie-panel",
    "name": "HardiePanel Vertical Siding 4x9",
    "sku": null,
    "avgCents": 6100,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot",
    "supplierUrl": "https://www.jameshardie.com/",
    "notes": "5/16 inch, primed, 8-inch OC pattern [range $50.00-$72.00]"
  },
  {
    "materialTypeSlug": "siding--wood-siding",
    "name": "Cedar Bevel Siding",
    "sku": null,
    "avgCents": 550,
    "uom": "SF",
    "wastePercent": 5,
    "supplier": "Specialty lumber yards",
    "supplierUrl": "https://homeguide.com/costs/cedar-siding-cost",
    "notes": "Clapboard/lap siding, various grades [range $2.75-$9.00]"
  },
  {
    "materialTypeSlug": "siding--wood-siding",
    "name": "Cedar Wood Shingles",
    "sku": null,
    "avgCents": 1000,
    "uom": "SF",
    "wastePercent": 5,
    "supplier": "Specialty lumber yards",
    "supplierUrl": "https://homeguide.com/costs/cedar-siding-cost",
    "notes": "Thin shingles, Grade A-C varies [range $2.50-$20.00]"
  },
  {
    "materialTypeSlug": "siding--wood-siding",
    "name": "Pine Siding",
    "sku": null,
    "avgCents": 300,
    "uom": "SF",
    "wastePercent": 5,
    "supplier": "Lumber yards",
    "supplierUrl": "https://homeguide.com/costs/wood-siding-cost-to-install-or-replace",
    "notes": "Economy wood siding option [range $1.00-$5.00]"
  },
  {
    "materialTypeSlug": "siding--siding-accessories",
    "name": "J-Channel Vinyl Trim (10 ft)",
    "sku": null,
    "avgCents": 500,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Lowe's, Home Depot",
    "supplierUrl": "https://www.lowes.com/",
    "notes": "1-1.5 inch wide [range $3.50-$6.50]"
  },
  {
    "materialTypeSlug": "siding--siding-accessories",
    "name": "Starter Strip Vinyl (10 ft)",
    "sku": null,
    "avgCents": 550,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Lowe's, Home Depot",
    "supplierUrl": "https://www.lowes.com/",
    "notes": "For vinyl siding installation [range $4.00-$7.00]"
  },
  {
    "materialTypeSlug": "siding--siding-accessories",
    "name": "Corner Posts Outside/Inside",
    "sku": null,
    "avgCents": 900,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Lowe's",
    "supplierUrl": "https://exteriorsolutions.com/",
    "notes": "Vinyl, 8-10 ft height [range $6.00-$12.00]"
  },
  {
    "materialTypeSlug": "siding--siding-accessories",
    "name": "F-Channel Utility Trim (10 ft)",
    "sku": null,
    "avgCents": 625,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.homedepot.com/",
    "notes": "Vinyl F-channel [range $4.50-$8.00]"
  },
  {
    "materialTypeSlug": "siding--hardietrim",
    "name": "HardieTrim 0.75 x 3.5 x 12 ft - Primed",
    "sku": null,
    "avgCents": 2150,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.homedepot.com/",
    "notes": "Fiber cement trim, 4/4 thickness [range $18.00-$25.00]"
  },
  {
    "materialTypeSlug": "siding--hardietrim",
    "name": "HardieTrim 0.75 x 5.5 x 12 ft - Primed",
    "sku": null,
    "avgCents": 2850,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.homedepot.com/",
    "notes": "Fiber cement trim, 4/4 thickness [range $24.00-$33.00]"
  },
  {
    "materialTypeSlug": "siding--hardietrim",
    "name": "HardieTrim 1 x 5.5 x 12 ft - Primed",
    "sku": null,
    "avgCents": 3300,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.homedepot.com/",
    "notes": "Fiber cement trim, 5/4 thickness [range $28.00-$38.00]"
  },
  {
    "materialTypeSlug": "woods-lumber--framing-lumber",
    "name": "2x4 SPF #2 - 8 ft",
    "sku": null,
    "avgCents": 450,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's, 84 Lumber",
    "supplierUrl": "https://www.homedepot.com/",
    "notes": "Standard framing lumber [range $3.00-$6.00]"
  },
  {
    "materialTypeSlug": "woods-lumber--framing-lumber",
    "name": "2x4 SPF #2 - 10 ft",
    "sku": null,
    "avgCents": 575,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.homedepot.com/",
    "notes": "Standard framing lumber [range $4.00-$7.50]"
  },
  {
    "materialTypeSlug": "woods-lumber--framing-lumber",
    "name": "2x4 SPF #2 - 12 ft",
    "sku": null,
    "avgCents": 700,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, 84 Lumber",
    "supplierUrl": "https://designtransitionstudio.com/2x4-lumber-cost-price-u-s-buyers/",
    "notes": "Standard framing lumber [range $5.00-$9.00]"
  },
  {
    "materialTypeSlug": "woods-lumber--framing-lumber",
    "name": "2x6 SPF #2 - 8 ft",
    "sku": null,
    "avgCents": 775,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.grahamlumber.com/",
    "notes": "Standard framing [range $6.00-$9.50]"
  },
  {
    "materialTypeSlug": "woods-lumber--framing-lumber",
    "name": "2x6 SPF #2 - 10 ft",
    "sku": null,
    "avgCents": 1000,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.homedepot.com/",
    "notes": "Standard framing [range $8.00-$12.00]"
  },
  {
    "materialTypeSlug": "woods-lumber--framing-lumber",
    "name": "2x6 SPF #2 - 12 ft",
    "sku": null,
    "avgCents": 1200,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://designtransitionstudio.com/",
    "notes": "Standard framing [range $9.50-$14.50]"
  },
  {
    "materialTypeSlug": "woods-lumber--framing-lumber",
    "name": "2x8 SPF #2 - 8 ft",
    "sku": null,
    "avgCents": 1100,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, 84 Lumber",
    "supplierUrl": "https://costflowai.com/calculators/framing/",
    "notes": "Standard framing [range $8.50-$13.50]"
  },
  {
    "materialTypeSlug": "woods-lumber--framing-lumber",
    "name": "2x8 SPF #2 - 12 ft",
    "sku": null,
    "avgCents": 1550,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, 84 Lumber",
    "supplierUrl": "https://costflowai.com/calculators/framing/",
    "notes": "Standard framing [range $12.00-$19.00]"
  },
  {
    "materialTypeSlug": "woods-lumber--framing-lumber",
    "name": "2x10 SPF #2 - 8 ft",
    "sku": null,
    "avgCents": 1425,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, 84 Lumber",
    "supplierUrl": "https://costflowai.com/calculators/framing/",
    "notes": "Standard framing [range $11.00-$17.50]"
  },
  {
    "materialTypeSlug": "woods-lumber--framing-lumber",
    "name": "2x10 SPF #2 - 12 ft",
    "sku": null,
    "avgCents": 1950,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, 84 Lumber",
    "supplierUrl": "https://costflowai.com/calculators/framing/",
    "notes": "Standard framing [range $15.00-$24.00]"
  },
  {
    "materialTypeSlug": "woods-lumber--framing-lumber",
    "name": "2x12 SPF #2 - 8 ft",
    "sku": null,
    "avgCents": 1725,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, 84 Lumber",
    "supplierUrl": "https://costflowai.com/calculators/framing/",
    "notes": "Standard framing [range $13.50-$21.00]"
  },
  {
    "materialTypeSlug": "woods-lumber--framing-lumber",
    "name": "2x12 SPF #2 - 16 ft",
    "sku": null,
    "avgCents": 2750,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, 84 Lumber",
    "supplierUrl": "https://costflowai.com/calculators/framing/",
    "notes": "Longer length [range $20.00-$35.00]"
  },
  {
    "materialTypeSlug": "woods-lumber--pressure-treated",
    "name": "PT 2x4 - 8 ft",
    "sku": null,
    "avgCents": 1000,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.lowes.com/",
    "notes": "Ground contact or above-ground [range $8.00-$12.00]"
  },
  {
    "materialTypeSlug": "woods-lumber--pressure-treated",
    "name": "PT 2x6 - 8 ft",
    "sku": null,
    "avgCents": 1550,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.lowes.com/",
    "notes": "Ground contact available [range $13.00-$18.00]"
  },
  {
    "materialTypeSlug": "woods-lumber--pressure-treated",
    "name": "PT 4x4 - 8 ft",
    "sku": null,
    "avgCents": 1850,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.lowes.com/",
    "notes": "Post or decking grade [range $15.00-$22.00]"
  },
  {
    "materialTypeSlug": "woods-lumber--pressure-treated",
    "name": "PT 6x6 - 8 ft",
    "sku": null,
    "avgCents": 3000,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.lowes.com/",
    "notes": "#2 Premium treated [range $25.00-$35.00]"
  },
  {
    "materialTypeSlug": "woods-lumber--plywood",
    "name": "Plywood CDX 1/2 in (4x8)",
    "sku": null,
    "avgCents": 2400,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.fbisupplynh.com/",
    "notes": "Construction/sheathing, 15/32 actual [range $20.00-$28.00]"
  },
  {
    "materialTypeSlug": "woods-lumber--plywood",
    "name": "Plywood CDX 3/4 in (4x8)",
    "sku": null,
    "avgCents": 3300,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.ezwoodshop.com/",
    "notes": "Construction/sheathing, 23/32 actual [range $28.00-$38.00]"
  },
  {
    "materialTypeSlug": "woods-lumber--plywood",
    "name": "Plywood Sanded 1/2 in (4x8)",
    "sku": null,
    "avgCents": 4750,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://trayedit.com/",
    "notes": "Sanded face, better finish [range $40.00-$55.00]"
  },
  {
    "materialTypeSlug": "woods-lumber--plywood",
    "name": "Plywood Sanded 3/4 in (4x8)",
    "sku": null,
    "avgCents": 5500,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://trayedit.com/",
    "notes": "Sanded face, construction grade [range $45.00-$65.00]"
  },
  {
    "materialTypeSlug": "woods-lumber--osb",
    "name": "OSB 7/16 in (4x8)",
    "sku": null,
    "avgCents": 1300,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.angi.com/articles/cost-of-osb-board.htm",
    "notes": "Sheathing application [range $10.00-$16.00]"
  },
  {
    "materialTypeSlug": "woods-lumber--osb",
    "name": "OSB 23/32 in (4x8)",
    "sku": null,
    "avgCents": 2300,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.angi.com/articles/cost-of-osb-board.htm",
    "notes": "Subfloor/sheathing [range $18.00-$28.00]"
  },
  {
    "materialTypeSlug": "woods-lumber--board-lumber",
    "name": "Pine/Poplar 1x4",
    "sku": null,
    "avgCents": 300,
    "uom": "LF",
    "wastePercent": 5,
    "supplier": "American Wood Moldings",
    "supplierUrl": "https://www.americanwoodmoldings.com/",
    "notes": "Shelving, trim backing [range $2.00-$4.50]"
  },
  {
    "materialTypeSlug": "woods-lumber--board-lumber",
    "name": "Pine/Poplar 1x6",
    "sku": null,
    "avgCents": 425,
    "uom": "LF",
    "wastePercent": 5,
    "supplier": "American Wood Moldings",
    "supplierUrl": "https://www.americanwoodmoldings.com/",
    "notes": "Shelving, flooring [range $3.00-$5.50]"
  },
  {
    "materialTypeSlug": "woods-lumber--board-lumber",
    "name": "Pine/Poplar 1x8",
    "sku": null,
    "avgCents": 550,
    "uom": "LF",
    "wastePercent": 5,
    "supplier": "American Wood Moldings",
    "supplierUrl": "https://www.americanwoodmoldings.com/",
    "notes": "Shelving, paneling [range $4.25-$7.00]"
  },
  {
    "materialTypeSlug": "woods-lumber--board-lumber",
    "name": "Pine/Poplar 1x12",
    "sku": null,
    "avgCents": 825,
    "uom": "LF",
    "wastePercent": 5,
    "supplier": "American Wood Moldings",
    "supplierUrl": "https://www.americanwoodmoldings.com/",
    "notes": "Shelves, flooring [range $6.50-$10.50]"
  },
  {
    "materialTypeSlug": "finish-carpentry--baseboards",
    "name": "MDF Baseboard - 3 in Profile",
    "sku": null,
    "avgCents": 175,
    "uom": "LF",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://homeguide.com/costs/baseboard-installation-cost",
    "notes": "Primed, ready to paint [range $1.00-$2.50]"
  },
  {
    "materialTypeSlug": "finish-carpentry--baseboards",
    "name": "MDF Baseboard - 4.5 in Profile",
    "sku": null,
    "avgCents": 225,
    "uom": "LF",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://homeguide.com/costs/baseboard-installation-cost",
    "notes": "Primed standard profile [range $1.50-$3.00]"
  },
  {
    "materialTypeSlug": "finish-carpentry--baseboards",
    "name": "MDF Baseboard - 5.25 in Profile",
    "sku": null,
    "avgCents": 275,
    "uom": "LF",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://homeguide.com/costs/baseboard-installation-cost",
    "notes": "Primed larger profile [range $2.00-$3.50]"
  },
  {
    "materialTypeSlug": "finish-carpentry--baseboards",
    "name": "Primed Pine Baseboard - 3 in",
    "sku": null,
    "avgCents": 225,
    "uom": "LF",
    "wastePercent": 5,
    "supplier": "Home Depot, lumber yards",
    "supplierUrl": "https://homeguide.com/costs/baseboard-installation-cost",
    "notes": "Solid pine, higher quality [range $1.50-$3.25]"
  },
  {
    "materialTypeSlug": "finish-carpentry--baseboards",
    "name": "Primed Pine Baseboard - 4.5 in",
    "sku": null,
    "avgCents": 300,
    "uom": "LF",
    "wastePercent": 5,
    "supplier": "Home Depot, lumber yards",
    "supplierUrl": "https://homeguide.com/costs/baseboard-installation-cost",
    "notes": "Solid pine [range $2.00-$4.00]"
  },
  {
    "materialTypeSlug": "finish-carpentry--crown-molding",
    "name": "MDF Crown Molding - Standard",
    "sku": null,
    "avgCents": 200,
    "uom": "LF",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://homeguide.com/costs/crown-molding-cost",
    "notes": "Primed, various profiles [range $1.00-$3.00]"
  },
  {
    "materialTypeSlug": "finish-carpentry--crown-molding",
    "name": "Primed Pine Crown Molding",
    "sku": null,
    "avgCents": 275,
    "uom": "LF",
    "wastePercent": 5,
    "supplier": "Home Depot, lumber yards",
    "supplierUrl": "https://homeguide.com/costs/crown-molding-cost",
    "notes": "Solid pine, standard profile [range $1.50-$4.00]"
  },
  {
    "materialTypeSlug": "finish-carpentry--casing",
    "name": "MDF Door/Window Casing",
    "sku": null,
    "avgCents": 125,
    "uom": "LF",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://homeguide.com/costs/interior-trim-installation-cost",
    "notes": "Primed MDF interior [range $0.60-$2.00]"
  },
  {
    "materialTypeSlug": "finish-carpentry--casing",
    "name": "Pine Door/Window Casing",
    "sku": null,
    "avgCents": 200,
    "uom": "LF",
    "wastePercent": 5,
    "supplier": "Home Depot, lumber yards",
    "supplierUrl": "https://homeguide.com/costs/interior-trim-installation-cost",
    "notes": "Primed pine interior [range $1.00-$3.00]"
  },
  {
    "materialTypeSlug": "finish-carpentry--interior-doors",
    "name": "Prehung Hollow Core 6-Panel 28 in",
    "sku": null,
    "avgCents": 7500,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.lowes.com/",
    "notes": "Primed molded hollow core [range $60.00-$90.00]"
  },
  {
    "materialTypeSlug": "finish-carpentry--interior-doors",
    "name": "Prehung Hollow Core 6-Panel 30 in",
    "sku": null,
    "avgCents": 8000,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.menards.com/",
    "notes": "Primed molded hollow core [range $65.00-$95.00]"
  },
  {
    "materialTypeSlug": "finish-carpentry--interior-doors",
    "name": "Prehung Hollow Core 6-Panel 32 in",
    "sku": null,
    "avgCents": 8500,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.lowes.com/",
    "notes": "Primed molded hollow core [range $70.00-$100.00]"
  },
  {
    "materialTypeSlug": "finish-carpentry--interior-doors",
    "name": "Prehung Hollow Core 6-Panel 36 in",
    "sku": null,
    "avgCents": 9500,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.lowes.com/",
    "notes": "Primed molded hollow core [range $80.00-$110.00]"
  },
  {
    "materialTypeSlug": "finish-carpentry--interior-doors",
    "name": "Prehung Solid Core 6-Panel 36 in",
    "sku": null,
    "avgCents": 20000,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "ETO Doors, Schillings",
    "supplierUrl": "https://schillings.com/",
    "notes": "Better sound dampening, durability [range $150.00-$250.00]"
  },
  {
    "materialTypeSlug": "finish-carpentry--door-hardware",
    "name": "Passage Knob - Builder Grade",
    "sku": null,
    "avgCents": 2000,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.homedepot.com/",
    "notes": "Non-locking passage [range $15.00-$25.00]"
  },
  {
    "materialTypeSlug": "finish-carpentry--door-hardware",
    "name": "Passage Knob - Schlage/Kwikset",
    "sku": null,
    "avgCents": 3250,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.homedepot.com/",
    "notes": "Mid-grade name brand [range $25.00-$40.00]"
  },
  {
    "materialTypeSlug": "finish-carpentry--door-hardware",
    "name": "Privacy Knob - Builder Grade",
    "sku": null,
    "avgCents": 2750,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.homedepot.com/",
    "notes": "Bathroom/bedroom lock [range $20.00-$35.00]"
  },
  {
    "materialTypeSlug": "finish-carpentry--door-hardware",
    "name": "Privacy Knob - Schlage/Kwikset",
    "sku": null,
    "avgCents": 4000,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.homedepot.com/",
    "notes": "Name brand locking [range $30.00-$50.00]"
  },
  {
    "materialTypeSlug": "finish-carpentry--door-hardware",
    "name": "Keyed Entry Knob - Builder Grade",
    "sku": null,
    "avgCents": 3250,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.homedepot.com/",
    "notes": "Keyed entry budget [range $25.00-$40.00]"
  },
  {
    "materialTypeSlug": "finish-carpentry--door-hardware",
    "name": "Keyed Entry Knob - Schlage/Kwikset",
    "sku": null,
    "avgCents": 5250,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Amazon",
    "supplierUrl": "https://www.amazon.com/",
    "notes": "Keyed entry name brand [range $40.00-$65.00]"
  },
  {
    "materialTypeSlug": "finish-carpentry--moldings",
    "name": "Shoe Molding MDF",
    "sku": null,
    "avgCents": 100,
    "uom": "LF",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.angi.com/articles/cost-to-install-shoe-molding.htm",
    "notes": "Primed 1/2 x 3/4 in [range $0.50-$1.50]"
  },
  {
    "materialTypeSlug": "finish-carpentry--moldings",
    "name": "Shoe Molding Pine",
    "sku": null,
    "avgCents": 170,
    "uom": "LF",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.angi.com/articles/cost-to-install-shoe-molding.htm",
    "notes": "Primed pine 1/2 x 3/4 in [range $0.90-$2.50]"
  },
  {
    "materialTypeSlug": "finish-carpentry--moldings",
    "name": "Quarter Round MDF",
    "sku": null,
    "avgCents": 100,
    "uom": "LF",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.angi.com/",
    "notes": "Primed MDF [range $0.50-$1.75]"
  },
  {
    "materialTypeSlug": "finish-carpentry--moldings",
    "name": "Quarter Round Pine",
    "sku": null,
    "avgCents": 135,
    "uom": "LF",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://floorstoyourhome.com/",
    "notes": "Primed pine [range $0.75-$2.00]"
  },
  {
    "materialTypeSlug": "windows-doors--vinyl-windows",
    "name": "Vinyl Double-Hung 28x52 - Builder Grade",
    "sku": null,
    "avgCents": 25000,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://homeguide.com/costs/window-replacement-cost-2026",
    "notes": "JeldWen Silver Line equiv [range $175.00-$325.00]"
  },
  {
    "materialTypeSlug": "windows-doors--vinyl-windows",
    "name": "Vinyl Double-Hung 32x52 - Builder Grade",
    "sku": null,
    "avgCents": 28000,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.replacementwindowsreviews.co/",
    "notes": "Common bedroom size [range $200.00-$375.00]"
  },
  {
    "materialTypeSlug": "windows-doors--vinyl-windows",
    "name": "Vinyl Double-Hung 36x60 - Builder Grade",
    "sku": null,
    "avgCents": 32500,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.replacementwindowsreviews.co/",
    "notes": "Master bedroom size [range $225.00-$425.00]"
  },
  {
    "materialTypeSlug": "windows-doors--vinyl-windows",
    "name": "Vinyl Casement 24x38 - Builder Grade",
    "sku": null,
    "avgCents": 25000,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://homeguide.com/costs/window-replacement-cost-2026",
    "notes": "Kitchen/bathroom size [range $180.00-$320.00]"
  },
  {
    "materialTypeSlug": "windows-doors--vinyl-windows",
    "name": "Vinyl Slider 36x36 - Builder Grade",
    "sku": null,
    "avgCents": 26500,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://homeguide.com/costs/window-replacement-cost-2026",
    "notes": "Basement/slider [range $190.00-$340.00]"
  },
  {
    "materialTypeSlug": "windows-doors--mid-tier-windows",
    "name": "Andersen 100 Series Double-Hung 24x38",
    "sku": null,
    "avgCents": 45000,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Andersen, ABC Supply",
    "supplierUrl": "https://www.replacementwindowsreviews.co/",
    "notes": "Fibrex composite [range $350.00-$550.00]"
  },
  {
    "materialTypeSlug": "windows-doors--mid-tier-windows",
    "name": "Andersen 200 Series Double-Hung 24x38",
    "sku": null,
    "avgCents": 52500,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Andersen, specialty dealers",
    "supplierUrl": "https://www.replacementwindowsreviews.co/",
    "notes": "Wood interior, vinyl exterior [range $400.00-$650.00]"
  },
  {
    "materialTypeSlug": "windows-doors--mid-tier-windows",
    "name": "Harvey Classic Vinyl Double-Hung",
    "sku": null,
    "avgCents": 46500,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Harvey Windows",
    "supplierUrl": "https://www.replacementwindowsreviews.co/",
    "notes": "Northeast regional brand [range $350.00-$600.00]"
  },
  {
    "materialTypeSlug": "windows-doors--entry-doors",
    "name": "Steel Entry Door Prehung 32 in",
    "sku": null,
    "avgCents": 30000,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Masonite",
    "supplierUrl": "https://energyhomeimprovements.com/",
    "notes": "Includes frame, no hardware [range $200.00-$400.00]"
  },
  {
    "materialTypeSlug": "windows-doors--entry-doors",
    "name": "Steel Entry Door Prehung 36 in",
    "sku": null,
    "avgCents": 32500,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Masonite",
    "supplierUrl": "https://energyhomeimprovements.com/",
    "notes": "ADA width [range $225.00-$425.00]"
  },
  {
    "materialTypeSlug": "windows-doors--entry-doors",
    "name": "Fiberglass Entry Door Prehung 32 in - Therma-Tru",
    "sku": null,
    "avgCents": 47500,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Therma-Tru",
    "supplierUrl": "https://www.thermatru.com/",
    "notes": "Better dent resistance [range $350.00-$600.00]"
  },
  {
    "materialTypeSlug": "windows-doors--entry-doors",
    "name": "Fiberglass Entry Door Prehung 36 in - Therma-Tru",
    "sku": null,
    "avgCents": 52500,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Therma-Tru",
    "supplierUrl": "https://www.thermatru.com/",
    "notes": "Premium weather resistance [range $375.00-$650.00]"
  },
  {
    "materialTypeSlug": "windows-doors--entry-doors",
    "name": "Masonite Hollow Core Entry 32 in",
    "sku": null,
    "avgCents": 21500,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Masonite",
    "supplierUrl": "https://www.homedepot.com/",
    "notes": "Budget option [range $150.00-$280.00]"
  },
  {
    "materialTypeSlug": "windows-doors--entry-doors",
    "name": "Masonite Solid Core Entry 36 in",
    "sku": null,
    "avgCents": 27500,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Masonite",
    "supplierUrl": "https://www.homedepot.com/",
    "notes": "Better sound insulation [range $200.00-$350.00]"
  },
  {
    "materialTypeSlug": "windows-doors--patio-doors",
    "name": "Vinyl Sliding Patio Door 6 ft",
    "sku": null,
    "avgCents": 65000,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Pella, Andersen",
    "supplierUrl": "https://homeguide.com/costs/sliding-glass-doors-prices",
    "notes": "Double-pane glass [range $450.00-$900.00]"
  },
  {
    "materialTypeSlug": "windows-doors--patio-doors",
    "name": "Vinyl Sliding Patio Door 8 ft",
    "sku": null,
    "avgCents": 85000,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Pella, Harvey",
    "supplierUrl": "https://homeguide.com/costs/sliding-glass-doors-prices",
    "notes": "Master bedroom size [range $600.00-$1200.00]"
  },
  {
    "materialTypeSlug": "windows-doors--storm-doors",
    "name": "Storm Door Larson/EMCO 32 in",
    "sku": null,
    "avgCents": 30000,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Larson, EMCO",
    "supplierUrl": "https://www.larsondoors.com/",
    "notes": "Self-storing screen [range $180.00-$450.00]"
  },
  {
    "materialTypeSlug": "windows-doors--storm-doors",
    "name": "Storm Door Larson/EMCO 36 in",
    "sku": null,
    "avgCents": 35000,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.consumerreports.org/",
    "notes": "Main entry protection [range $200.00-$500.00]"
  },
  {
    "materialTypeSlug": "windows-doors--exterior-hardware",
    "name": "Exterior Deadbolt - Schlage/Kwikset",
    "sku": null,
    "avgCents": 7500,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.schlage.com/",
    "notes": "Keyed deadbolt [range $35.00-$120.00]"
  },
  {
    "materialTypeSlug": "windows-doors--exterior-hardware",
    "name": "Exterior Handleset - Schlage/Kwikset",
    "sku": null,
    "avgCents": 11000,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Schlage",
    "supplierUrl": "https://www.schlage.com/",
    "notes": "Knob + deadbolt combo [range $60.00-$180.00]"
  },
  {
    "materialTypeSlug": "decks-exterior--composite-decking",
    "name": "Trex Enhance 5/4 x 6 - 12 ft",
    "sku": null,
    "avgCents": 450,
    "uom": "LF",
    "wastePercent": 5,
    "supplier": "Home Depot, ABC Supply",
    "supplierUrl": "https://www.trex.com/",
    "notes": "Entry-level Trex [range $3.50-$5.50]"
  },
  {
    "materialTypeSlug": "decks-exterior--composite-decking",
    "name": "Trex Enhance 5/4 x 6 - 16 ft",
    "sku": null,
    "avgCents": 450,
    "uom": "LF",
    "wastePercent": 5,
    "supplier": "Trex distributors",
    "supplierUrl": "https://deckbros.com/",
    "notes": "Same $/LF as 12 ft [range $3.50-$5.50]"
  },
  {
    "materialTypeSlug": "decks-exterior--composite-decking",
    "name": "Trex Transcend 5/4 x 6 - 12 ft",
    "sku": null,
    "avgCents": 875,
    "uom": "LF",
    "wastePercent": 5,
    "supplier": "Home Depot, ABC Supply",
    "supplierUrl": "https://www.trex.com/",
    "notes": "Premium Trex line [range $7.50-$10.00]"
  },
  {
    "materialTypeSlug": "decks-exterior--composite-decking",
    "name": "TimberTech AZEK 5/4 x 6",
    "sku": null,
    "avgCents": 800,
    "uom": "LF",
    "wastePercent": 5,
    "supplier": "Home Depot, AZEK",
    "supplierUrl": "https://homeguide.com/costs/azek-decking-prices",
    "notes": "PVC-rich core [range $6.50-$9.50]"
  },
  {
    "materialTypeSlug": "decks-exterior--composite-decking",
    "name": "Fiberon Good Life 5/4 x 6",
    "sku": null,
    "avgCents": 475,
    "uom": "LF",
    "wastePercent": 5,
    "supplier": "Home Depot",
    "supplierUrl": "https://www.fiberondecking.com/",
    "notes": "Budget-friendly composite [range $3.50-$6.00]"
  },
  {
    "materialTypeSlug": "decks-exterior--composite-decking",
    "name": "Fiberon Sanctuary/Concordia 5/4 x 6",
    "sku": null,
    "avgCents": 700,
    "uom": "LF",
    "wastePercent": 5,
    "supplier": "Fiberon dealers",
    "supplierUrl": "https://www.fiberondecking.com/",
    "notes": "Mid-premium line [range $5.50-$8.50]"
  },
  {
    "materialTypeSlug": "decks-exterior--pt-decking",
    "name": "PT Deck Board 5/4 x 6",
    "sku": null,
    "avgCents": 175,
    "uom": "LF",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://homeguide.com/costs/pressure-treated-decking-cost",
    "notes": "ACQ or CA treatment [range $1.25-$2.25]"
  },
  {
    "materialTypeSlug": "decks-exterior--pt-decking",
    "name": "PT Deck Board 2x6",
    "sku": null,
    "avgCents": 165,
    "uom": "LF",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://homeguide.com/costs/pressure-treated-decking-cost",
    "notes": "Requires staining every 2-3 yr [range $1.15-$2.15]"
  },
  {
    "materialTypeSlug": "decks-exterior--railings",
    "name": "Composite Railing Section 6 ft",
    "sku": null,
    "avgCents": 32500,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, deck suppliers",
    "supplierUrl": "https://deckbros.com/",
    "notes": "Includes balusters [range $250.00-$425.00]"
  },
  {
    "materialTypeSlug": "decks-exterior--railings",
    "name": "Aluminum Railing Section 6 ft",
    "sku": null,
    "avgCents": 42500,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Trex Signature, specialty",
    "supplierUrl": "https://deckbros.com/",
    "notes": "More durable, thermal breaks [range $350.00-$550.00]"
  },
  {
    "materialTypeSlug": "decks-exterior--deck-hardware",
    "name": "Joist Hanger Simpson LUS210",
    "sku": null,
    "avgCents": 375,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.manasquanfasteners.com/",
    "notes": "For 2x10 joist [range $2.50-$5.00]"
  },
  {
    "materialTypeSlug": "decks-exterior--deck-hardware",
    "name": "Post Base Simpson ABU",
    "sku": null,
    "avgCents": 750,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.fastenersplus.com/",
    "notes": "Adjustable 4x4 [range $5.00-$10.00]"
  },
  {
    "materialTypeSlug": "decks-exterior--deck-hardware",
    "name": "Deck Screws 2.5 in (5 lb box)",
    "sku": null,
    "avgCents": 2500,
    "uom": "BX",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.homedepot.com/",
    "notes": "~450-500 screws per box [range $18.00-$35.00]"
  },
  {
    "materialTypeSlug": "decks-exterior--deck-hardware",
    "name": "Hidden Fastener Clips (25 ct)",
    "sku": null,
    "avgCents": 2200,
    "uom": "BX",
    "wastePercent": 5,
    "supplier": "Trex, TimberTech",
    "supplierUrl": "https://deckbros.com/",
    "notes": "~8-10 clips per board [range $15.00-$35.00]"
  },
  {
    "materialTypeSlug": "decks-exterior--gutters",
    "name": "Aluminum K-Style Gutter 5 in",
    "sku": null,
    "avgCents": 600,
    "uom": "LF",
    "wastePercent": 5,
    "supplier": "Home Depot, ABC Supply",
    "supplierUrl": "https://homeguide.com/costs/gutter-installation-cost",
    "notes": "Sectional, multi colors [range $4.50-$7.50]"
  },
  {
    "materialTypeSlug": "decks-exterior--gutters",
    "name": "Aluminum K-Style Gutter 6 in",
    "sku": null,
    "avgCents": 700,
    "uom": "LF",
    "wastePercent": 5,
    "supplier": "Home Depot, gutter suppliers",
    "supplierUrl": "https://homeguide.com/costs/aluminum-gutters-installation-cost",
    "notes": "50% more capacity [range $5.50-$8.50]"
  },
  {
    "materialTypeSlug": "decks-exterior--gutters",
    "name": "Aluminum Seamless Gutter 5 in",
    "sku": null,
    "avgCents": 1050,
    "uom": "LF",
    "wastePercent": 5,
    "supplier": "Seamless gutter shops",
    "supplierUrl": "https://homeguide.com/costs/aluminum-gutters-installation-cost",
    "notes": "Custom length, no seams [range $8.50-$13.00]"
  },
  {
    "materialTypeSlug": "decks-exterior--gutters",
    "name": "Aluminum Downspout 2x3 in",
    "sku": null,
    "avgCents": 475,
    "uom": "LF",
    "wastePercent": 5,
    "supplier": "Home Depot, gutter suppliers",
    "supplierUrl": "https://homeguide.com/costs/gutter-installation-cost",
    "notes": "One per 30-35 LF gutter [range $3.50-$6.00]"
  },
  {
    "materialTypeSlug": "decks-exterior--gutters",
    "name": "Gutter Accessories (elbows, brackets, caps)",
    "sku": null,
    "avgCents": 500,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://homeguide.com/costs/gutter-installation-cost",
    "notes": "20-40 pieces per system [range $3.00-$8.00]"
  },
  {
    "materialTypeSlug": "insulation-drywall--fiberglass-batt",
    "name": "R-13 Batt - 2x4 wall (3.5 in)",
    "sku": null,
    "avgCents": 4800,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Owens Corning",
    "supplierUrl": "https://homeguide.com/costs/batt-roll-insulation-cost",
    "notes": "~40-50 sq ft per roll [range $35.00-$65.00]"
  },
  {
    "materialTypeSlug": "insulation-drywall--fiberglass-batt",
    "name": "R-19 Batt - 2x6 wall (5.5 in)",
    "sku": null,
    "avgCents": 6200,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Owens Corning",
    "supplierUrl": "https://homeguide.com/costs/batt-roll-insulation-cost",
    "notes": "Energy code compliant [range $45.00-$85.00]"
  },
  {
    "materialTypeSlug": "insulation-drywall--fiberglass-batt",
    "name": "R-30 Batt - Ceiling (9.5 in)",
    "sku": null,
    "avgCents": 8200,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Owens Corning",
    "supplierUrl": "https://homeguide.com/costs/batt-roll-insulation-cost",
    "notes": "Blown-in often preferred [range $60.00-$110.00]"
  },
  {
    "materialTypeSlug": "insulation-drywall--fiberglass-batt",
    "name": "R-38 Batt - Attic (10-14 in)",
    "sku": null,
    "avgCents": 10000,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://homeguide.com/costs/batt-roll-insulation-cost",
    "notes": "Excellent attic insulation [range $75.00-$130.00]"
  },
  {
    "materialTypeSlug": "insulation-drywall--rigid-foam",
    "name": "XPS Foam Board R-5 (1 in) 4x8",
    "sku": null,
    "avgCents": 2600,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://homeguide.com/costs/rigid-foam-insulation-cost",
    "notes": "Moisture resistant, basement [range $20.00-$35.00]"
  },
  {
    "materialTypeSlug": "insulation-drywall--rigid-foam",
    "name": "XPS Foam Board R-10 (2 in) 4x8",
    "sku": null,
    "avgCents": 4400,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://homeguide.com/costs/rigid-foam-insulation-cost",
    "notes": "Foundation, continuous exterior [range $35.00-$55.00]"
  },
  {
    "materialTypeSlug": "insulation-drywall--rigid-foam",
    "name": "Polyiso Board R-6 (1 in) 4x8",
    "sku": null,
    "avgCents": 2400,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://homeguide.com/costs/rigid-foam-insulation-cost",
    "notes": "Foil facing for air sealing [range $18.00-$32.00]"
  },
  {
    "materialTypeSlug": "insulation-drywall--rigid-foam",
    "name": "Polyiso Board R-12 (2 in) 4x8",
    "sku": null,
    "avgCents": 4000,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://homeguide.com/costs/rigid-foam-insulation-cost",
    "notes": "Dow Thermax, RMax brands [range $32.00-$52.00]"
  },
  {
    "materialTypeSlug": "insulation-drywall--spray-foam",
    "name": "Spray Foam - Window/Door 12 oz",
    "sku": null,
    "avgCents": 600,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Great Stuff",
    "supplierUrl": "https://www.greatstuff.dupont.com/",
    "notes": "Low expansion, seals 4-6 windows [range $4.00-$9.00]"
  },
  {
    "materialTypeSlug": "insulation-drywall--spray-foam",
    "name": "Spray Foam - Gaps/Cracks 12 oz",
    "sku": null,
    "avgCents": 500,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Great Stuff",
    "supplierUrl": "https://www.greatstuff.dupont.com/",
    "notes": "Standard expansion [range $3.00-$8.00]"
  },
  {
    "materialTypeSlug": "insulation-drywall--drywall",
    "name": "Drywall 1/2 in x 4x8 Standard",
    "sku": null,
    "avgCents": 1500,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://homeguide.com/costs/sheetrock-drywall-prices",
    "notes": "Standard interior walls [range $12.00-$18.00]"
  },
  {
    "materialTypeSlug": "insulation-drywall--drywall",
    "name": "Drywall 1/2 in x 4x12 Standard",
    "sku": null,
    "avgCents": 1700,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://homeguide.com/costs/sheetrock-drywall-prices",
    "notes": "Fewer seams, higher ceilings [range $14.00-$20.00]"
  },
  {
    "materialTypeSlug": "insulation-drywall--drywall",
    "name": "Drywall 5/8 in x 4x8 Fire-Rated",
    "sku": null,
    "avgCents": 1900,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://homeguide.com/costs/sheetrock-drywall-prices",
    "notes": "Type X, garages [range $16.00-$22.00]"
  },
  {
    "materialTypeSlug": "insulation-drywall--drywall",
    "name": "Drywall 1/2 in x 4x8 Moisture-Resistant",
    "sku": null,
    "avgCents": 1700,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://homeguide.com/costs/sheetrock-drywall-prices",
    "notes": "Green board, bath/kitchen [range $14.00-$20.00]"
  },
  {
    "materialTypeSlug": "insulation-drywall--drywall-finishing",
    "name": "Joint Compound All-Purpose 4.5 gal",
    "sku": null,
    "avgCents": 2300,
    "uom": "BX",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.homedepot.com/",
    "notes": "Sheetrock brand, ~300-400 sq ft [range $18.00-$28.00]"
  },
  {
    "materialTypeSlug": "insulation-drywall--drywall-finishing",
    "name": "Joint Compound Lightweight 5 gal",
    "sku": null,
    "avgCents": 2500,
    "uom": "BX",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.lowesprosupply.com/",
    "notes": "Plus 3, easier sanding [range $20.00-$30.00]"
  },
  {
    "materialTypeSlug": "insulation-drywall--drywall-finishing",
    "name": "Paper Drywall Tape 500 ft",
    "sku": null,
    "avgCents": 1100,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.homedepot.com/",
    "notes": "Standard paper tape [range $8.00-$14.00]"
  },
  {
    "materialTypeSlug": "insulation-drywall--drywall-finishing",
    "name": "Mesh Drywall Tape 300 ft",
    "sku": null,
    "avgCents": 900,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.homedepot.com/",
    "notes": "Self-adhesive fiberglass [range $7.00-$12.00]"
  },
  {
    "materialTypeSlug": "insulation-drywall--drywall-finishing",
    "name": "Metal Corner Bead 10 ft",
    "sku": null,
    "avgCents": 225,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.homedepot.com/",
    "notes": "Steel reinforced [range $1.50-$3.00]"
  },
  {
    "materialTypeSlug": "insulation-drywall--drywall-finishing",
    "name": "Paper-Faced Corner Bead 10 ft",
    "sku": null,
    "avgCents": 275,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.homedepot.com/",
    "notes": "Lighter, faster application [range $2.00-$3.50]"
  },
  {
    "materialTypeSlug": "insulation-drywall--drywall-fasteners",
    "name": "Drywall Screws 1-1/4 in Coarse (5 lb)",
    "sku": null,
    "avgCents": 1700,
    "uom": "BX",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.homedepot.com/",
    "notes": "Wood studs, ~1400-1600 screws [range $12.00-$22.00]"
  },
  {
    "materialTypeSlug": "insulation-drywall--drywall-fasteners",
    "name": "Drywall Screws 1-5/8 in Coarse (5 lb)",
    "sku": null,
    "avgCents": 1800,
    "uom": "BX",
    "wastePercent": 5,
    "supplier": "Home Depot, Lowe's",
    "supplierUrl": "https://www.homedepot.com/",
    "notes": "Metal studs, slightly more [range $13.00-$24.00]"
  },
  {
    "materialTypeSlug": "siding--pvc-trim-sealed-edge",
    "name": "GA Sealed Edge PVC Trim 1x3 x 18'",
    "sku": null,
    "avgCents": 1745,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual 3/4\" x 2-1/2\" x 18' - sealed edge finish"
  },
  {
    "materialTypeSlug": "siding--pvc-trim-sealed-edge",
    "name": "GA Sealed Edge PVC Trim 1x4 x 18'",
    "sku": null,
    "avgCents": 2556,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual 3/4\" x 3-1/2\" x 18' - sealed edge finish"
  },
  {
    "materialTypeSlug": "siding--pvc-trim-sealed-edge",
    "name": "GA Sealed Edge PVC Trim 1x5 x 18'",
    "sku": null,
    "avgCents": 3271,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual 3/4\" x 4-1/2\" x 18' - sealed edge finish"
  },
  {
    "materialTypeSlug": "siding--pvc-trim-sealed-edge",
    "name": "GA Sealed Edge PVC Trim 1x6 x 18'",
    "sku": null,
    "avgCents": 4020,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual 3/4\" x 5-1/2\" x 18' - sealed edge finish"
  },
  {
    "materialTypeSlug": "siding--pvc-trim-sealed-edge",
    "name": "GA Sealed Edge PVC Trim 1x8 x 18'",
    "sku": null,
    "avgCents": 5281,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual 3/4\" x 7-1/4\" x 18' - sealed edge finish"
  },
  {
    "materialTypeSlug": "siding--pvc-trim-sealed-edge",
    "name": "GA Sealed Edge PVC Trim 1x10 x 18'",
    "sku": null,
    "avgCents": 6747,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual 3/4\" x 9-1/4\" x 18' - sealed edge finish"
  },
  {
    "materialTypeSlug": "siding--pvc-trim-sealed-edge",
    "name": "GA Sealed Edge PVC Trim 1x12 x 18'",
    "sku": null,
    "avgCents": 8209,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual 3/4\" x 11-1/4\" x 18' - sealed edge finish"
  },
  {
    "materialTypeSlug": "siding--pvc-trim-sealed-edge",
    "name": "GA Sealed Edge PVC Trim 1x16 x 18'",
    "sku": null,
    "avgCents": 11139,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual 3/4\" x 15-1/4\" x 18' - sealed edge finish"
  },
  {
    "materialTypeSlug": "siding--pvc-trim-sealed-edge",
    "name": "GA Sealed Edge PVC Trim 5/4x4 x 18'",
    "sku": null,
    "avgCents": 3557,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual 1\" x 3-1/2\" x 18' - sealed edge finish"
  },
  {
    "materialTypeSlug": "siding--pvc-trim-sealed-edge",
    "name": "GA Sealed Edge PVC Trim 5/4x5 x 18'",
    "sku": null,
    "avgCents": 4553,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual 1\" x 4-1/2\" x 18' - sealed edge finish"
  },
  {
    "materialTypeSlug": "siding--pvc-trim-sealed-edge",
    "name": "GA Sealed Edge PVC Trim 5/4x6 x 18'",
    "sku": null,
    "avgCents": 5593,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual 1\" x 5-1/2\" x 18' - sealed edge finish"
  },
  {
    "materialTypeSlug": "siding--pvc-trim-sealed-edge",
    "name": "GA Sealed Edge PVC Trim 5/4x8 x 18'",
    "sku": null,
    "avgCents": 7353,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual 1\" x 7-1/4\" x 18' - sealed edge finish"
  },
  {
    "materialTypeSlug": "siding--pvc-trim-sealed-edge",
    "name": "GA Sealed Edge PVC Trim 5/4x10 x 18'",
    "sku": null,
    "avgCents": 9389,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual 1\" x 9-1/4\" x 18' - sealed edge finish"
  },
  {
    "materialTypeSlug": "siding--pvc-trim-sealed-edge",
    "name": "GA Sealed Edge PVC Trim 5/4x12 x 18'",
    "sku": null,
    "avgCents": 11425,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual 1\" x 11-1/4\" x 18' - sealed edge finish"
  },
  {
    "materialTypeSlug": "siding--pvc-trim-sealed-edge",
    "name": "GA Sealed Edge PVC Trim 5/4x16 x 18'",
    "sku": null,
    "avgCents": 14188,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual 1\" x 15-1/4\" x 18' - sealed edge finish"
  },
  {
    "materialTypeSlug": "siding--pvc-trim-sealed-edge",
    "name": "GA Sealed Edge PVC Trim 6/4x4 x 18'",
    "sku": null,
    "avgCents": 6960,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual 1-1/4\" x 3-1/2\" x 18' - sealed edge finish"
  },
  {
    "materialTypeSlug": "siding--pvc-trim-sealed-edge",
    "name": "GA Sealed Edge PVC Trim 6/4x6 x 18'",
    "sku": null,
    "avgCents": 10999,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual 1-1/4\" x 5-1/2\" x 18' - sealed edge finish"
  },
  {
    "materialTypeSlug": "siding--pvc-trim-sealed-edge",
    "name": "GA Sealed Edge PVC Trim 6/4x8 x 18'",
    "sku": null,
    "avgCents": 14430,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual 1-1/4\" x 7-1/4\" x 18' - sealed edge finish"
  },
  {
    "materialTypeSlug": "siding--pvc-trim-sealed-edge",
    "name": "GA Sealed Edge PVC Trim 6/4x10 x 18'",
    "sku": null,
    "avgCents": 18250,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual 1-1/4\" x 9-1/4\" x 18' - sealed edge finish"
  },
  {
    "materialTypeSlug": "siding--pvc-trim-sealed-edge",
    "name": "GA Sealed Edge PVC Trim 6/4x12 x 18'",
    "sku": null,
    "avgCents": 22464,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual 1-1/4\" x 11-1/4\" x 18' - sealed edge finish"
  },
  {
    "materialTypeSlug": "siding--pvc-trim-specialty",
    "name": "GA PVC Trim 5/4x4 x 18' w/ Single Rabbet",
    "sku": null,
    "avgCents": 4185,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual 1\" x 3-1/2\" x 18' - specialty with single rabbet"
  },
  {
    "materialTypeSlug": "siding--pvc-trim-specialty",
    "name": "GA PVC Trim 5/4x5 x 18' w/ Single Rabbet",
    "sku": null,
    "avgCents": 5356,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual 1\" x 4-1/2\" x 18' - specialty with single rabbet"
  },
  {
    "materialTypeSlug": "siding--pvc-trim-specialty",
    "name": "GA PVC Trim 5/4x6 x 18' w/ Single Rabbet",
    "sku": null,
    "avgCents": 6580,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual 1\" x 5-1/2\" x 18' - specialty with single rabbet"
  },
  {
    "materialTypeSlug": "siding--pvc-trim-specialty",
    "name": "GA PVC Trim 5/4x8 x 18' w/ Single Rabbet",
    "sku": null,
    "avgCents": 8651,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual 1\" x 7-1/4\" x 18' - specialty with single rabbet"
  },
  {
    "materialTypeSlug": "siding--pvc-trim-specialty",
    "name": "GA PVC Trim 5/4x10 x 18' w/ Single Rabbet",
    "sku": null,
    "avgCents": 11046,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual 1\" x 9-1/4\" x 18' - specialty with single rabbet"
  },
  {
    "materialTypeSlug": "siding--pvc-corners",
    "name": "GA - 6\" Extruded Corner w/J and Nail Fin",
    "sku": "GA6EC",
    "avgCents": 15999,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "SKU GA6EC - Size 1-1/8\" x 20' (3/4\" J pocket)"
  },
  {
    "materialTypeSlug": "siding--pvc-corners",
    "name": "GA - 4\" Trim Corner Square Edge",
    "sku": "GA4TCS",
    "avgCents": 14499,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "SKU GA4TCS - Size 1\" x 20'"
  },
  {
    "materialTypeSlug": "siding--pvc-corners",
    "name": "GA - 6\" Trim Corner Square Edge",
    "sku": "GA6TCS",
    "avgCents": 22499,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "SKU GA6TCS - Size 1\" x 20'"
  },
  {
    "materialTypeSlug": "siding--pvc-corners",
    "name": "GA - 4\" Trim Corner w/J",
    "sku": "GA4TCJ",
    "avgCents": 15499,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "SKU GA4TCJ - Size 1\" x 20' (3/4\" rabbet)"
  },
  {
    "materialTypeSlug": "siding--pvc-corners",
    "name": "GA - 6\" Trim Corner w/J",
    "sku": "GA6TCJ",
    "avgCents": 23499,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "SKU GA6TCJ - Size 1\" x 20' (3/4\" rabbet)"
  },
  {
    "materialTypeSlug": "siding--pvc-mouldings",
    "name": "GA PVC 2-1/4\" Crown",
    "sku": "GA51",
    "avgCents": 3106,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "SKU GA51 - 9/16\" x 2-1/4\" x 18'"
  },
  {
    "materialTypeSlug": "siding--pvc-mouldings",
    "name": "GA PVC 3-5/8\" Crown",
    "sku": "GA49",
    "avgCents": 3206,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "SKU GA49 - 9/16\" x 3-5/8\" x 18'"
  },
  {
    "materialTypeSlug": "siding--pvc-mouldings",
    "name": "GA PVC 4-5/8\" Crown",
    "sku": "GA47",
    "avgCents": 3749,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "SKU GA47 - 5/8\" x 4-5/8\" x 18'"
  },
  {
    "materialTypeSlug": "siding--pvc-mouldings",
    "name": "GA PVC 5-1/2\" Crown",
    "sku": "GA45",
    "avgCents": 4269,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "SKU GA45 - 9/16\" x 5-1/2\" x 18'"
  },
  {
    "materialTypeSlug": "siding--pvc-mouldings",
    "name": "GA PVC Rams Crown",
    "sku": "GA68",
    "avgCents": 3999,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "SKU GA68 - 1-13/32\" x 2\" x 18'"
  },
  {
    "materialTypeSlug": "siding--pvc-mouldings",
    "name": "GA PVC Bed Moulding",
    "sku": "GA75",
    "avgCents": 1390,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "SKU GA75 - 9/16\" x 1-5/8\" x 18'"
  },
  {
    "materialTypeSlug": "siding--pvc-mouldings",
    "name": "GA PVC Back Band",
    "sku": "BTP2590",
    "avgCents": 3077,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "SKU BTP2590 - 1-3/16\" x 4-1/2\" x 18'"
  },
  {
    "materialTypeSlug": "siding--pvc-mouldings",
    "name": "GA PVC Band",
    "sku": "GA217",
    "avgCents": 1901,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "SKU GA217 - 5/8\" x 1-3/4\" x 18'"
  },
  {
    "materialTypeSlug": "siding--pvc-mouldings",
    "name": "GA PVC Base Cap",
    "sku": "GA164",
    "avgCents": 1267,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "SKU GA164 - 11/16\" x 1-1/8\" x 18'"
  },
  {
    "materialTypeSlug": "siding--pvc-mouldings",
    "name": "GA PVC Beadboard",
    "sku": "GA0001",
    "avgCents": 4499,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "SKU GA0001 - 1/2\" x 5-1/8\" x 18'"
  },
  {
    "materialTypeSlug": "siding--pvc-mouldings",
    "name": "GA PVC Stealth Beadboard",
    "sku": "GA0002",
    "avgCents": 4999,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "SKU GA0002 - 1/2\" x 6\" x 18'"
  },
  {
    "materialTypeSlug": "siding--pvc-mouldings",
    "name": "GA PVC Beaded Planking",
    "sku": "GABP",
    "avgCents": 3499,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "SKU GABP - 3/8\" x 5-1/2\" x 18'"
  },
  {
    "materialTypeSlug": "siding--pvc-mouldings",
    "name": "GA PVC Brick Mould",
    "sku": "GA180",
    "avgCents": 2862,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "SKU GA180 - 1-1/4\" x 2\" x 18'"
  },
  {
    "materialTypeSlug": "siding--pvc-mouldings",
    "name": "GA PVC Brick Mould w/Nail Fin",
    "sku": "GA183",
    "avgCents": 2774,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "SKU GA183 - 1-1/4\" x 3\" x 18'"
  },
  {
    "materialTypeSlug": "siding--pvc-mouldings",
    "name": "GA PVC Cove",
    "sku": "GA093",
    "avgCents": 1007,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "SKU GA093 - 3/4\" x 3/4\" x 18'"
  },
  {
    "materialTypeSlug": "siding--pvc-mouldings",
    "name": "GA PVC Drip Cap",
    "sku": "GA197",
    "avgCents": 1699,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "SKU GA197 - 11/16\" x 1-5/8\" x 18'"
  },
  {
    "materialTypeSlug": "siding--pvc-mouldings",
    "name": "GA PVC Quarter Round 18'",
    "sku": "GA105",
    "avgCents": 1104,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "SKU GA105 - 3/4\" x 3/4\" x 18'"
  },
  {
    "materialTypeSlug": "siding--pvc-mouldings",
    "name": "GA PVC Quarter Round 8'",
    "sku": "GA105",
    "avgCents": 399,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "SKU GA105 - 3/4\" x 3/4\" x 8'"
  },
  {
    "materialTypeSlug": "siding--pvc-mouldings",
    "name": "GA PVC Sill Nose",
    "sku": "GA937",
    "avgCents": 2492,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "SKU GA937 - 1-3/8\" x 1-5/16\" x 18'"
  },
  {
    "materialTypeSlug": "siding--pvc-mouldings",
    "name": "GA PVC Historical Sill",
    "sku": "GA6930",
    "avgCents": 7499,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "SKU GA6930 - 1-3/4\" x 2-1/32\" x 18'"
  },
  {
    "materialTypeSlug": "siding--pvc-mouldings",
    "name": "GA PVC Colonial Base",
    "sku": "GACB",
    "avgCents": 3499,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "SKU GACB - 9/16\" x 3-1/4\" x 18'"
  },
  {
    "materialTypeSlug": "siding--pvc-mouldings",
    "name": "GA PVC Colonial Shoe",
    "sku": "GACS",
    "avgCents": 1499,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "SKU GACS - 11/16\" x 3-1/4\" x 18'"
  },
  {
    "materialTypeSlug": "siding--pvc-mouldings",
    "name": "GA PVC Trim Corner",
    "sku": "GATC",
    "avgCents": 1899,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "SKU GATC - 1/4\" x 1-1/8\" x 18'"
  },
  {
    "materialTypeSlug": "siding--pvc-mouldings",
    "name": "GA PVC Square Baluster",
    "sku": "GASB",
    "avgCents": 4499,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "SKU GASB - 1-1/2\" x 1-1/2\" x 18'"
  },
  {
    "materialTypeSlug": "siding--pvc-mouldings",
    "name": "GA PVC Flat Astragal",
    "sku": "GAFA",
    "avgCents": 2655,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "SKU GAFA - 13/32\" x 2-3/8\" x 18'"
  },
  {
    "materialTypeSlug": "siding--pvc-mouldings",
    "name": "GA PVC Water Table",
    "sku": "GAWT",
    "avgCents": 5499,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "SKU GAWT - 2\" x 2-3/4\" x 18'"
  },
  {
    "materialTypeSlug": "siding--pvc-mouldings",
    "name": "GA PVC 6\" Casing/Lineal",
    "sku": "GA618",
    "avgCents": 8308,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "SKU GA618 - 1-1/8\" x 5-1/2\" x 18'"
  },
  {
    "materialTypeSlug": "siding--pvc-mouldings",
    "name": "GA PVC 4\" Casing/Lineal",
    "sku": "GA7467",
    "avgCents": 5496,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "SKU GA7467 - 1-1/8\" x 3-1/2\" x 18'"
  },
  {
    "materialTypeSlug": "siding--pvc-sheet",
    "name": "GA PVC Sheet 1/4\" x 4' x 10'",
    "sku": null,
    "avgCents": 8500,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual size 1/4\" x 4' x 10'"
  },
  {
    "materialTypeSlug": "siding--pvc-sheet",
    "name": "GA PVC Sheet 1/4\" x 4' x 20'",
    "sku": null,
    "avgCents": 15000,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual size 1/4\" x 4' x 20'"
  },
  {
    "materialTypeSlug": "siding--pvc-sheet",
    "name": "GA PVC Sheet 3/8\" x 4' x 10'",
    "sku": null,
    "avgCents": 10000,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual size 3/8\" x 4' x 10'"
  },
  {
    "materialTypeSlug": "siding--pvc-sheet",
    "name": "GA PVC Sheet 3/8\" x 4' x 20'",
    "sku": null,
    "avgCents": 19000,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual size 3/8\" x 4' x 20'"
  },
  {
    "materialTypeSlug": "siding--pvc-sheet",
    "name": "GA PVC Sheet 1/2\" x 4' x 10'",
    "sku": null,
    "avgCents": 15000,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual size 1/2\" x 4' x 10'"
  },
  {
    "materialTypeSlug": "siding--pvc-sheet",
    "name": "GA PVC Sheet 1/2\" x 4' x 20'",
    "sku": null,
    "avgCents": 27500,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual size 1/2\" x 4' x 20'"
  },
  {
    "materialTypeSlug": "siding--pvc-sheet",
    "name": "GA PVC Sheet 3/4\" x 4' x 10'",
    "sku": null,
    "avgCents": 20000,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual size 3/4\" x 4' x 10'"
  },
  {
    "materialTypeSlug": "siding--pvc-sheet",
    "name": "GA PVC Sheet 3/4\" x 4' x 20'",
    "sku": null,
    "avgCents": 38000,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual size 3/4\" x 4' x 20'"
  },
  {
    "materialTypeSlug": "siding--pvc-sheet",
    "name": "GA PVC Sheet 1\" x 4' x 10'",
    "sku": null,
    "avgCents": 26000,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual size 1\" x 4' x 10'"
  },
  {
    "materialTypeSlug": "siding--pvc-sheet",
    "name": "GA PVC Sheet 1\" x 4' x 20'",
    "sku": null,
    "avgCents": 50000,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual size 1\" x 4' x 20'"
  },
  {
    "materialTypeSlug": "siding--pvc-sheet",
    "name": "GA PVC Sheet 1-1/4\" x 4' x 10'",
    "sku": null,
    "avgCents": 50000,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual size 1-1/4\" x 4' x 10'"
  },
  {
    "materialTypeSlug": "siding--pvc-sheet",
    "name": "GA PVC Sheet 1-1/4\" x 4' x 20'",
    "sku": null,
    "avgCents": 90000,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual size 1-1/4\" x 4' x 20'"
  },
  {
    "materialTypeSlug": "siding--pvc-sheet",
    "name": "GA PVC Sheet 1/2\" x 4' x 10' Beaded",
    "sku": null,
    "avgCents": 20000,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual size 1/2\" x 4' x 10' Beaded - beaded profile"
  },
  {
    "materialTypeSlug": "siding--pvc-sheet",
    "name": "GA PVC Sheet 1/2\" x 4' x 20' Beaded",
    "sku": null,
    "avgCents": 39000,
    "uom": "EA",
    "wastePercent": 5,
    "supplier": "Green Atlantic via PVC Direct",
    "supplierUrl": null,
    "notes": "Actual size 1/2\" x 4' x 20' Beaded - beaded profile"
  }
];

async function main() {
  const company = await prisma.company.findUnique({ where: { slug: COMPANY_SLUG } });
  if (!company) {
    throw new Error(`Company with slug "${COMPANY_SLUG}" not found. Seed companies first.`);
  }
  const companyId = company.id;
  console.log(`Target company: ${company.name} (${companyId})`);

  // Pass 1: MaterialTypes (root first, then children)
  const slugToId = new Map<string, string>();
  for (const t of materialTypes.filter(t => !t.parentSlug)) {
    const created = await prisma.materialType.upsert({
      where: { companyId_slug: { companyId, slug: t.slug } } as any, // needs @@unique([companyId, slug])
      update: { name: t.name },
      create: { companyId, slug: t.slug, name: t.name, parentId: null },
    });
    slugToId.set(t.slug, created.id);
  }
  for (const t of materialTypes.filter(t => t.parentSlug)) {
    const parentId = slugToId.get(t.parentSlug!);
    if (!parentId) throw new Error(`Parent slug not found: ${t.parentSlug}`);
    const created = await prisma.materialType.upsert({
      where: { companyId_slug: { companyId, slug: t.slug } } as any,
      update: { name: t.name, parentId },
      create: { companyId, slug: t.slug, name: t.name, parentId },
    });
    slugToId.set(t.slug, created.id);
  }
  console.log(`Upserted ${materialTypes.length} material types`);

  // Pass 2: Materials
  let created = 0;
  let updated = 0;
  for (const m of materials) {
    const materialTypeId = slugToId.get(m.materialTypeSlug);
    if (!materialTypeId) {
      console.warn(`Skipping "${m.name}" — unknown type slug ${m.materialTypeSlug}`);
      continue;
    }
    const existing = await prisma.material.findFirst({
      where: { companyId, name: m.name },
    });
    if (existing) {
      await prisma.material.update({
        where: { id: existing.id },
        data: {
          materialTypeId,
          sku: m.sku,
          avgCents: m.avgCents,
          uom: m.uom,
          wastePercent: m.wastePercent,
          supplier: m.supplier,
          supplierUrl: m.supplierUrl,
          notes: m.notes,
          lastPricedAt: new Date(),
        },
      });
      updated++;
    } else {
      await prisma.material.create({
        data: {
          companyId,
          materialTypeId,
          name: m.name,
          sku: m.sku,
          avgCents: m.avgCents,
          uom: m.uom,
          wastePercent: m.wastePercent,
          supplier: m.supplier,
          supplierUrl: m.supplierUrl,
          notes: m.notes,
          lastPricedAt: new Date(),
        },
      });
      created++;
    }
  }
  console.log(`Materials: ${created} created, ${updated} updated`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
