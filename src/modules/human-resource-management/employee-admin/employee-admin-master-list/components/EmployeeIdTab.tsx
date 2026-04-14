import React, { useRef } from "react";
import { User } from "../types";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toPng } from "html-to-image";
import Image from "next/image";

interface EmployeeIdTabProps {
  user: User;
}

export function EmployeeIdTab({ user }: EmployeeIdTabProps) {
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);

  // Format Name
  const formattedName = `${user.firstName} ${user.middleName ? user.middleName.charAt(0) + '. ' : ''}${user.lastName}`.toUpperCase();
  const position = (user.position || "EMPLOYEE").toUpperCase();

  // Address assembly - only City and Province as requested
  const addressParts = [user.city, user.province].filter(Boolean);
  const address = addressParts.length > 0 ? addressParts.join(", ").toUpperCase() : "N/A";

  const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  
  const resolveImageUrl = (path?: string | null) => {
    if (!path) return "";
    if (path.startsWith("http") || path.startsWith("blob:")) return path;
    if (isUUID(path)) {
      return `/api/hrm/employee-admin/employee-master-list/assets/${path}`;
    }
    const base = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") || "";
    return `${base}${path}`;
  };

  const imageUrl = resolveImageUrl(user.image);
  const signatureUrl = resolveImageUrl(user.signature);

  const idStyle: React.CSSProperties = {
    width: "408px",
    height: "648px",
    position: "relative",
    overflow: "hidden",
    boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
    borderRadius: "12px",
    backgroundColor: "white",
    flexShrink: 0,
  };

  const exportToPng = async (ref: React.RefObject<HTMLDivElement | null>, side: string) => {
    if (!ref.current) return;
    try {
      const dataUrl = await toPng(ref.current, {
        canvasWidth: 638,
        canvasHeight: 1011,
        style: {
          transform: 'none',
          boxShadow: 'none',
          borderRadius: '0',
        },
      });
      const link = document.createElement('a');
      link.download = `ID-${side}-${user.firstName}-${user.lastName}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row gap-8 justify-center items-start py-6 bg-muted/20 rounded-2xl min-h-[750px]">
        
        {/* FRONT SIDE */}
        <div className="flex flex-col items-center gap-6">
          <div className="relative group" style={{ perspective: "1000px" }}>
            <div className="text-center mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-widest">Front</div>
            <div 
              ref={frontRef} 
              className="id-card-wrapper transition-transform duration-300 group-hover:shadow-2xl"
              style={idStyle}
            >
              <Image 
                src="/id_front_template.png" 
                alt="ID Front Background" 
                className="absolute inset-0 w-full h-full object-cover z-0"
                crossOrigin="anonymous"
                width={408}
                height={648}
                unoptimized
              />
              
              <div className="absolute inset-0 z-10 flex flex-col items-center">
                <div 
                  className="absolute top-[21%] rounded-full overflow-hidden border-[4px] border-[#0e2a3f] bg-white flex items-center justify-center shadow-lg"
                  style={{ width: "194px", height: "194px", left: "50%", transform: "translateX(-50%)" }}
                >
                  {imageUrl ? (
                    <Image src={imageUrl} alt="Employee" className="w-full h-full object-cover" crossOrigin="anonymous" width={194} height={194} unoptimized />
                  ) : (
                    <span className="text-4xl font-bold text-muted-foreground">{user.firstName.charAt(0)}{user.lastName.charAt(0)}</span>
                  )}
                </div>

                <div className="absolute top-[52%] w-full px-4 text-center">
                  <h1 className="text-3xl font-black text-black leading-tight break-words uppercase " style={{ fontFamily: "Arial Black, Impact, sans-serif", WebkitTextStroke: "1px white", letterSpacing: "-0.5px" }}>
                    {formattedName}
                  </h1>
                  <h2 className="text-[17px] font-bold text-black tracking-wide font-sans" style={{ fontFamily: "Arial Black, Impact, sans-serif", WebkitTextStroke: ".5px white", letterSpacing: "-0.5px" }}>
                    {position}
                  </h2>
                </div>

                <div className="absolute top-[62.6%] left-[30.5%] flex flex-col gap-[6px]">
                  <div className="text-[17px] font-bold text-black font-sans leading-tight h-[18px] flex items-center" style={{ fontFamily: "Arial Black, Impact, sans-serif", WebkitTextStroke: ".5px white", letterSpacing: "-0.5px" }}>
                    <span className="tracking-widest">{user.externalId || `MEN2-${String(user.id).padStart(4, '0')}`}</span>
                  </div>
                  <div className="text-[17px] font-bold text-black font-sans leading-tight h-[18px] flex items-center" style={{ fontFamily: "Arial Black, Impact, sans-serif", WebkitTextStroke: ".5px white", letterSpacing: "-0.5px" }}>
                    <span className="tracking-widest">{user.contact || "N/A"}</span>
                  </div>
                  <div className="text-[15px] font-bold text-black font-sans leading-tight h-[18px] flex items-center" style={{ fontFamily: "Arial Black, Impact, sans-serif", WebkitTextStroke: ".2px white", letterSpacing: "-0.5px" }}>
                    <span className="tracking-widest text-black lowercase">{user.email || "N/A"}</span>
                  </div>
                </div>

                <div className="absolute top-[73%] w-full flex justify-center px-10">
                  {signatureUrl && (
                    <Image src={signatureUrl} alt="Signature" className="max-h-[85px] w-auto object-contain" crossOrigin="anonymous" width={200} height={85} unoptimized />
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <Button 
            onClick={() => exportToPng(frontRef, "Front")} 
            variant="outline" 
            className="gap-2 h-11 rounded-xl w-[200px] border-primary/20 hover:border-primary hover:bg-primary/5 transition-all mt-2"
          >
            <Download className="h-4 w-4" />
            Export Front
          </Button>
        </div>

        {/* BACK SIDE */}
        <div className="flex flex-col items-center gap-6">
          <div className="relative group" style={{ perspective: "1000px" }}>
            <div className="text-center mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-widest">Back</div>
            <div 
              ref={backRef} 
              className="id-card-wrapper transition-transform duration-300 group-hover:shadow-2xl"
              style={idStyle}
            >
              <Image src="/id_back_template.png" alt="ID Back Background" className="absolute inset-0 w-full h-full object-cover z-0" crossOrigin="anonymous" width={408} height={648} unoptimized />

              <div className="absolute inset-0 z-10 flex flex-col">
                <div className="absolute top-[23.8%] left-[43%] right-[6%] flex flex-col gap-[4.2px]">
                  <div className="text-[13px] font-bold text-black font-sans leading-tight h-[16px] flex items-center" style={{ fontFamily: "Arial Black, Impact, sans-serif", WebkitTextStroke: ".3px white", letterSpacing: "-1.5px" }}>
                    <span className="uppercase whitespace-nowrap overflow-hidden text-ellipsis">{address}</span>
                  </div>
                  <div className="text-[14px] font-bold text-black font-sans leading-tight h-[16px] flex items-center" style={{ fontFamily: "Arial Black, Impact, sans-serif", WebkitTextStroke: ".5px white", letterSpacing: "-0.5px" }}>
                    <span className="uppercase">
                      {user.birthday ? new Date(user.birthday).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : "N/A"}
                    </span>
                  </div>
                  <div className="text-[14px] font-bold text-black font-sans leading-tight h-[17px] flex items-center" style={{ fontFamily: "Arial Black, Impact, sans-serif", WebkitTextStroke: ".5px white", letterSpacing: "-0.5px" }}>
                    <span>{user.sssNumber || "N/A"}</span>
                  </div>
                  <div className="text-[14px] font-bold text-black font-sans leading-tight h-[17px] flex items-center" style={{ fontFamily: "Arial Black, Impact, sans-serif", WebkitTextStroke: ".5px white", letterSpacing: "-0.5px" }}>
                    <span>{user.philHealthNumber || "N/A"}</span>
                  </div>
                  <div className="text-[14px] font-bold text-black font-sans leading-tight h-[17px] flex items-center" style={{ fontFamily: "Arial Black, Impact, sans-serif", WebkitTextStroke: ".5px white", letterSpacing: "-0.5px" }}>
                    <span>{user.pagibigNumber || "N/A"}</span>
                  </div>
                </div>

                <div className="absolute top-[40.8%] left-[6%] right-[6%] flex flex-col gap-1 items-center">
                   <div className="flex w-full items-center justify-center font-bold text-[15.5px] uppercase mt-[14px]">
                      <span className="truncate pr-4 text-center" style={{ fontFamily: "Arial Black, Impact, sans-serif", WebkitTextStroke: ".5px white", letterSpacing: "-0.5px" }}>{user.emergencyContactName || "N/A"}</span>
                      <span className="pl-4" style={{ fontFamily: "Arial Black, Impact, sans-serif", WebkitTextStroke: ".5px white", letterSpacing: "-0.5px" }}>{user.emergencyContactNumber || "N/A"}</span>
                   </div>
                </div>
              </div>
            </div>
          </div>
          <Button 
            onClick={() => exportToPng(backRef, "Back")} 
            variant="outline" 
            className="gap-2 h-11 rounded-xl w-[200px] border-primary/20 hover:border-primary hover:bg-primary/5 transition-all mt-2"
          >
            <Download className="h-4 w-4" />
            Export Back
          </Button>
        </div>

      </div>
    </div>
  );
}
