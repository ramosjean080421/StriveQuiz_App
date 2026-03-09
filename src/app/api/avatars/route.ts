import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
    try {
        const avatarsDir = path.join(process.cwd(), "public", "avatars");
        if (!fs.existsSync(avatarsDir)) {
            return NextResponse.json({ avatars: [] });
        }

        const files = fs.readdirSync(avatarsDir);

        // Allowed image extensions (mainly .gif for memes, but supporting others)
        const validExtensions = ['.gif', '.jpg', '.jpeg', '.png', '.webp', '.svg'];
        const images = files
            .filter(f => validExtensions.includes(path.extname(f).toLowerCase()))
            .map(f => `/avatars/${f}`);

        return NextResponse.json({ avatars: images });
    } catch (error) {
        console.error("Error reading avatars directory:", error);
        return NextResponse.json({ error: "Failed to read avatars directory" }, { status: 500 });
    }
}
