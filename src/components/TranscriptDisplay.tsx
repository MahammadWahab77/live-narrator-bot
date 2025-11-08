import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, User } from "lucide-react";

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
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-20">
            <Bot className="h-12 w-12 mb-4 text-primary/50" />
            <p className="text-lg font-medium">Ready to start</p>
            <p className="text-sm">Click "Start Voice Chat" and begin talking with Maya</p>
          </div>
        ) : (
          transcript.map((message, index) => (
            <div
              key={index}
              className={`flex gap-3 ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {message.role === "assistant" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-foreground"
                }`}
              >
                <p className="text-sm font-medium mb-1 opacity-70">
                  {message.role === "user" ? "You" : "Maya"}
                </p>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.text}</p>
              </div>
              {message.role === "user" && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-accent" />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </ScrollArea>
  );
};

export default TranscriptDisplay;
