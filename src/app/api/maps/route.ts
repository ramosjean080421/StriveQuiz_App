import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
    try {
        const mapsDir = path.join(process.cwd(), "public", "maps");
        if (!fs.existsSync(mapsDir)) {
            return NextResponse.json({ maps: [] });
        }

        const files = fs.readdirSync(mapsDir);

        // Allowed image extensions
        const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
        const images = files.filter(f => validExtensions.includes(path.extname(f).toLowerCase()));

        return NextResponse.json({ maps: images });
    } catch (error) {
        console.error("Error reading maps directory:", error);
        return NextResponse.json({ error: "Failed to read maps directory" }, { status: 500 });
    }
}
