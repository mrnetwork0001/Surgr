import { existsSync } from "node:fs";
import path from "node:path";
import Capabilities from "@/components/landing/Capabilities";
import Hero from "@/components/landing/Hero";

/** Optional photography under the animated backdrops. Drop 16:9 JPGs at these paths to enable. */
function optionalImage(file: string): string | undefined {
  return existsSync(path.join(process.cwd(), "public", "backdrops", file)) ? `/backdrops/${file}` : undefined;
}

export default function LandingPage() {
  return (
    <div className="bg-black font-body text-white">
      <Hero image={optionalImage("hero.jpg")} />
      <Capabilities image={optionalImage("capabilities.jpg")} />
    </div>
  );
}
