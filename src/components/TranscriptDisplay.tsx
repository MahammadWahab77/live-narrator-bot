import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  role: string;
  text: string;
}

interface TranscriptDisplayProps {
  transcript: Message[];
}

const TranscriptDisplay = ({ transcript }: TranscriptDisplayProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  return (
    <ScrollArea className="h-[400px] w-full border border-border rounded-lg p-4 bg-muted/30">
      <div ref={scrollRef} className="space-y-4">
        {transcript.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>Start the voice chat to begin your onboarding journey</p>
          </div>
        ) : (
          transcript.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-foreground"
                }`}
              >
                <p className="text-sm font-medium mb-1 opacity-70">
                  {message.role === "user" ? "You" : "Maya"}
                </p>
                <p className="text-sm whitespace-pre-wrap">{message.text}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </ScrollArea>
  );
};

export default TranscriptDisplay;
