// employee-report/components/GeotagEvidencePanel.tsx
"use client";
import { useEffect, useState } from "react";
import Image from "next/image";

const IMAGE_PROXY = "/api/hrm/workforce/attendance-report/employee-report/geotag/image";

interface GeotagRecord {
  geotag_id:   number;
  log_id:      number;
  kind:        "TIME_IN" | "TIME_OUT";
  position:    { type: string; coordinates: [number, number] } | null;
  image_path:  string | null;
  captured_at: string | null;
}

interface Props {
  logId:         number;
  logDate:       string;
  employeeName?: string;
  employeeId?:   number;
}

function fmt12(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function GeoCard({ tag, label }: { tag: GeotagRecord | undefined; label: string }) {
  const [imgError, setImgError] = useState(false);

  if (!tag) {
    return (
      <div className="flex-1 min-w-[280px] rounded-xl border border-border bg-muted/20 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border/50 bg-muted/30">
          <span className="text-xs font-bold text-foreground">{label}</span>
        </div>
        <div className="p-6 flex items-center justify-center h-[200px]">
          <p className="text-xs text-muted-foreground italic">No {label} geotag.</p>
        </div>
      </div>
    );
  }

  // coordinates = [longitude, latitude] in GeoJSON
  const [lng, lat] = tag.position?.coordinates ?? [null, null];
  const hasLocation = (
    lat !== null && lng !== null &&
    typeof lat === "number" && typeof lng === "number" &&
    !isNaN(lat) && !isNaN(lng)
  );

  const mapSrc = hasLocation
    ? `https://maps.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}&z=16&output=embed`
    : null;

  // image_path is a Directus asset UUID — route through our proxy
  const imageUrl =
    tag.image_path && tag.image_path.trim() && tag.image_path !== "null"
      ? `${IMAGE_PROXY}?id=${encodeURIComponent(tag.image_path)}`
      : null;

  return (
    <div className="flex-1 min-w-[280px] rounded-xl border border-border bg-background overflow-hidden">

      {/* Header */}
      <div className="px-4 py-2.5 border-b border-border/50 bg-muted/30 flex items-center justify-between">
        <span className="text-xs font-bold text-foreground">{label}</span>
        {tag.captured_at && (
          <span className="text-[11px] font-medium text-muted-foreground">
            {fmt12(tag.captured_at)}
          </span>
        )}
      </div>

      {/* Map + Photo side by side */}
      <div className="flex divide-x divide-border/50">

        {/* Map */}
        <div className="flex-1 min-w-0">
          {mapSrc ? (
            <iframe
              src={mapSrc}
              width="100%"
              height="240"
              style={{ border: 0, display: "block" }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div className="w-full h-[240px] flex items-center justify-center bg-muted/30">
              <p className="text-xs text-muted-foreground">No location data.</p>
            </div>
          )}
        </div>

        {/* Photo */}
        <div className="w-[180px] shrink-0">
          {imageUrl && !imgError ? (
            // Using standard img tag for local proxy endpoints that are secure
              <Image
                src={imageUrl}
                alt={`${label} photo`}
                className="w-full h-[240px] object-cover"
                width={320}
                height={240}
                onError={() => setImgError(true)}
                style={{ objectFit: 'cover' }}
              />
          ) : (
            <div className="w-full h-[240px] flex flex-col items-center justify-center bg-muted/20 gap-2 px-4">
              <svg
                className="w-8 h-8 text-muted-foreground/30"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="text-[11px] text-muted-foreground text-center">
                {imgError ? "Image failed to load" : "No photo"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer — coordinates + date */}
      <div className="px-4 py-2 border-t border-border/50 flex items-center justify-between gap-2 flex-wrap">
        {hasLocation ? (
          <span className="text-[11px] text-muted-foreground font-mono flex items-center gap-1">
            <span className="text-red-500">📍</span>
            {(lat as number).toFixed(6)}, {(lng as number).toFixed(6)}
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground italic">No coordinates</span>
        )}
        {tag.captured_at && (
          <span className="text-[11px] text-muted-foreground">
            {new Date(tag.captured_at).toLocaleDateString("en-US", {
              month: "short", day: "numeric", year: "numeric",
            })}
            {" · "}
            {fmt12(tag.captured_at)}
          </span>
        )}
      </div>
    </div>
  );
}

export function GeotagEvidencePanel({ logId, logDate, employeeName }: Props) {
  const [loading, setLoading] = useState(true);
  const [tags,    setTags]    = useState<GeotagRecord[]>([]);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!logId || logId === -1) {
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/hrm/workforce/attendance-report/employee-report/geotag?logId=${logId}`,
          { credentials: "include" }
        );
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json();
        setTags(data.tags ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load geotag");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [logId]);

  const timeIn  = tags.find((t) => t.kind === "TIME_IN");
  const timeOut = tags.find((t) => t.kind === "TIME_OUT");

  const dateDisplay = new Date(logDate + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });

  return (
    <div className="mx-2 mb-2 mt-0 rounded-xl border border-border bg-background shadow-sm overflow-hidden">

      {/* Panel header */}
      <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold uppercase tracking-wide text-foreground">
            Geotag Evidence
          </span>
          {employeeName && (
            <span className="text-xs font-semibold text-violet-600 px-2 py-1 bg-violet-50 rounded-md">
              {employeeName}
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground flex items-center gap-2">
          <span className="font-mono bg-muted/30 px-2 py-1 rounded">
            Log #{logId}
          </span>
          <span>·</span>
          <span className="font-semibold">{dateDisplay}</span>
        </span>
      </div>

      <div className="p-4">
        {loading ? (
          <div className="flex gap-4">
            <div className="flex-1 h-[300px] rounded-xl border border-border bg-muted/20 animate-pulse" />
            <div className="flex-1 h-[300px] rounded-xl border border-border bg-muted/20 animate-pulse" />
          </div>
        ) : error ? (
          <p className="text-xs text-red-500 py-4 text-center">Error: {error}</p>
        ) : tags.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center italic">
            No geotag records found for this log.
          </p>
        ) : (
          <div className="flex gap-4 flex-wrap">
            <GeoCard tag={timeIn}  label="Time In"  />
            <GeoCard tag={timeOut} label="Time Out" />
          </div>
        )}
      </div>
    </div>
  );
}
