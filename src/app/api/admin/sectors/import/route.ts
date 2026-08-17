import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { requireCapability } from "@/lib/api-guard";

type ImportRow = {
  Sector?: string;
  Trade?: string;
};

/**
 * Bulk-imports trades from an uploaded .xlsx file. Expected columns:
 *   Sector | Trade
 * A sector named in the sheet that doesn't already exist is created
 * automatically (matches your instruction that sectors are expandable).
 * Existing (sector, trade) pairs are skipped, not duplicated.
 *
 * Sent as multipart/form-data with a single "file" field.
 */
export async function POST(req: NextRequest) {
  const guard = await requireCapability("create");
  if (!guard.ok) return guard.response;

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return NextResponse.json({ error: "The uploaded file has no sheets." }, { status: 400 });
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<ImportRow>(sheet, { defval: "" });

  if (rows.length === 0) {
    return NextResponse.json({ error: "The sheet contains no data rows." }, { status: 400 });
  }

  const results = {
    sectorsCreated: 0,
    tradesCreated: 0,
    tradesSkipped: 0,
    errors: [] as string[],
  };

  const sectorCache = new Map<string, string>(); // sector name -> sector id

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const sectorName = String(row.Sector ?? "").trim();
    const tradeName = String(row.Trade ?? "").trim();
    const rowNum = i + 2; // +1 for 0-index, +1 for header row

    if (!sectorName || !tradeName) {
      results.errors.push(`Row ${rowNum}: missing Sector or Trade value, skipped.`);
      continue;
    }

    let sectorId = sectorCache.get(sectorName);
    if (!sectorId) {
      let sector = await prisma.sector.findUnique({ where: { name: sectorName } });
      if (!sector) {
        sector = await prisma.sector.create({ data: { name: sectorName } });
        results.sectorsCreated++;
      }
      sectorId = sector.id;
      sectorCache.set(sectorName, sectorId);
    }

    const existingTrade = await prisma.trade.findUnique({
      where: { sectorId_name: { sectorId, name: tradeName } },
    });
    if (existingTrade) {
      results.tradesSkipped++;
      continue;
    }

    await prisma.trade.create({ data: { sectorId, name: tradeName } });
    results.tradesCreated++;
  }

  return NextResponse.json({ results });
}
