import React, { useState } from "react";
import { X, Mail, Clock, CheckCircle, Loader } from "lucide-react";
import { scheduleReport } from "@/lib/tenable-api";
import { useToast } from "@/hooks/use-toast";
import { Dashboard } from "@/types/dashboard";

interface ScheduleReportDialogProps {
  dashboard: Dashboard;
  onClose: () => void;
}

export function ScheduleReportDialog({ dashboard, onClose }: ScheduleReportDialogProps) {
  const [email, setEmail] = useState("");
  const [frequency, setFrequency] = useState("weekly");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { toast } = useToast();

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubmitting(true);
    try {
      await scheduleReport({
        dashboardName: dashboard.name,
        email,
        frequency,
        widgets: dashboard.widgets,
        filters: dashboard.globalFilters || [],
      });
      setIsSuccess(true);
      toast({
        title: "Report Scheduled",
        description: `Successfully scheduled ${frequency} reports for ${email}`,
      });
      setTimeout(onClose, 2000);
    } catch (err: any) {
      toast({
        title: "Scheduling Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] bg-background/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-md mx-4 mb-8 bg-card border border-border rounded-lg shadow-2xl overflow-hidden animate-in slide-in-from-top-4 duration-300" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Schedule Report</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSchedule} className="p-6 space-y-4 font-sans">
          {isSuccess ? (
            <div className="py-8 flex flex-col items-center justify-center text-center space-y-3 font-sans">
              <CheckCircle className="w-12 h-12 text-success animate-in zoom-in duration-300" />
              <p className="text-lg font-semibold text-foreground tracking-tight">Successfully Scheduled!</p>
              <p className="text-sm text-muted-foreground font-medium">You will receive the first report shortly.</p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-sans">Dashboard</label>
                <div className="px-3 py-2 bg-secondary/50 rounded border border-border text-sm text-foreground font-semibold font-sans">
                  {dashboard.name}
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="email" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-sans">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    id="email"
                    type="email"
                    required
                    placeholder="security-reports@company.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 text-sm bg-secondary border border-border rounded-md text-foreground focus:ring-1 focus:ring-primary outline-none font-sans font-medium placeholder:text-muted-foreground/50 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-sans">Frequency</label>
                <div className="grid grid-cols-3 gap-2">
                  {["daily", "weekly", "monthly"].map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFrequency(f)}
                      className={`px-3 py-2 text-xs rounded border transition-all font-sans ${
                        frequency === f 
                          ? "bg-primary/15 border-primary text-primary font-bold shadow-sm" 
                          : "bg-secondary/50 border-border text-muted-foreground font-medium hover:text-foreground hover:bg-secondary"
                      }`}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors font-sans"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !email}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all shadow-lg shadow-primary/20 font-sans"
                >
                  {isSubmitting ? <Loader className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
                  Schedule Now
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
