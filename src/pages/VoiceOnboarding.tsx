import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Mic, MicOff, LogOut, Loader2, Volume2 } from "lucide-react";
import { User } from "@supabase/supabase-js";
import StageIndicator from "@/components/StageIndicator";
import TranscriptDisplay from "@/components/TranscriptDisplay";
import VoiceVisualizer from "@/components/VoiceVisualizer";
import { AudioRecorder, encodeAudioForAPI } from "@/utils/audioRecorder";
import { initAudioPlayer, playAudioChunk, clearAudioQueue } from "@/utils/audioPlayer";

const stages = [
  { id: 1, title: "Welcome", description: "Introduction to Maya" },
  { id: 2, title: "Program Value", description: "Learn about the program" },
  { id: 3, title: "Payment Structure", description: "Understand pricing" },
  { id: 4, title: "Scholarship", description: "Eligibility check" },
  { id: 5, title: "EMI Options", description: "Payment plans" },
  { id: 6, title: "Documents", description: "Required paperwork" },
  { id: 7, title: "Confirmation", description: "Final steps" },
];

const VoiceOnboarding = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentStage, setCurrentStage] = useState(1);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState<Array<{ role: string; text: string }>>([]);
  const [loading, setLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        loadOnboardingSession(session.user.id);
      } else {
        navigate("/auth");
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user);
      } else {
        navigate("/auth");
      }
    });

    return () => {
      subscription.unsubscribe();
      disconnectWebSocket();
    };
  }, [navigate]);

  const loadOnboardingSession = async (userId: string) => {
    const { data, error } = await supabase
      .from("onboarding_sessions")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (data) {
      setCurrentStage(data.current_stage);
      if (data.stage_data && typeof data.stage_data === 'object' && 'transcript' in data.stage_data) {
        const stageData = data.stage_data as { transcript?: Array<{ role: string; text: string }> };
        if (stageData.transcript) {
          setTranscript(stageData.transcript);
        }
      }
    } else if (!error || error.code === "PGRST116") {
      await supabase.from("onboarding_sessions").insert({
        user_id: userId,
        current_stage: 1,
        stage_data: { transcript: [] },
      });
    }
  };

  const connectWebSocket = async () => {
    try {
      // Initialize audio context
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 24000 });
        // Resume audio context on user interaction
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
        initAudioPlayer(audioContextRef.current);
      }

      const ws = new WebSocket(
        `wss://akkyfswcrjrucoghvenx.supabase.co/functions/v1/gemini-voice`
      );

      ws.onopen = async () => {
        console.log("WebSocket connected");
        setIsConnected(true);
        toast({
          title: "Connected",
          description: "Maya is ready to talk with you",
        });

        // Send setup message
        ws.send(
          JSON.stringify({
            type: "setup",
            stage: currentStage,
            stageName: stages[currentStage - 1].title,
          })
        );

        // Start audio recording
        try {
          recorderRef.current = new AudioRecorder((audioData) => {
            if (ws.readyState === WebSocket.OPEN) {
              const encodedAudio = encodeAudioForAPI(audioData);
              ws.send(
                JSON.stringify({
                  type: "audio",
                  data: encodedAudio,
                })
              );
            }
          });

          await recorderRef.current.start();
          setIsRecording(true);
          console.log("Audio recording started");
        } catch (error) {
          console.error("Failed to start recording:", error);
          toast({
            title: "Microphone Error",
            description: "Please allow microphone access to continue",
            variant: "destructive",
          });
        }
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("Received:", data);

        if (data.type === "transcript") {
          const newMessage = { role: data.role, text: data.text };
          setTranscript((prev) => [...prev, newMessage]);

          if (data.role === "assistant") {
            setIsSpeaking(false);
          }

          // Save to database
          if (user) {
            const currentTranscript = [...transcript, newMessage];
            supabase.from("onboarding_sessions").upsert({
              user_id: user.id,
              current_stage: currentStage,
              stage_data: { transcript: currentTranscript },
            });
          }
        } else if (data.type === "audio") {
          // Play audio chunk
          setIsSpeaking(true);
          if (audioContextRef.current) {
            playAudioChunk(data.data, audioContextRef.current);
          }
        } else if (data.type === "stage_complete") {
          if (currentStage < 7) {
            const nextStage = currentStage + 1;
            setCurrentStage(nextStage);
            toast({
              title: "Stage Complete!",
              description: `Moving to ${stages[nextStage - 1].title}`,
            });

            // Send new stage setup
            ws.send(
              JSON.stringify({
                type: "setup",
                stage: nextStage,
                stageName: stages[nextStage - 1].title,
              })
            );
          } else {
            toast({
              title: "Onboarding Complete!",
              description: "You've completed all stages successfully!",
            });
          }
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        toast({
          title: "Connection Error",
          description: "Failed to connect to Maya",
          variant: "destructive",
        });
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected");
        setIsConnected(false);
        setIsRecording(false);
        setIsSpeaking(false);
        
        if (recorderRef.current) {
          recorderRef.current.stop();
          recorderRef.current = null;
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("Error connecting:", error);
      toast({
        title: "Error",
        description: "Failed to initialize voice chat",
        variant: "destructive",
      });
    }
  };

  const disconnectWebSocket = () => {
    if (recorderRef.current) {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    clearAudioQueue();
    
    setIsRecording(false);
    setIsSpeaking(false);
  };

  const toggleConnection = () => {
    if (isConnected) {
      disconnectWebSocket();
    } else {
      connectWebSocket();
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">Maya Onboarding</h1>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <StageIndicator stages={stages} currentStage={currentStage} />

        <div className="mt-8 bg-card border border-border rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                {stages[currentStage - 1].title}
                {isSpeaking && (
                  <Volume2 className="h-5 w-5 text-accent animate-pulse" />
                )}
              </h2>
              <p className="text-sm text-muted-foreground">
                {stages[currentStage - 1].description}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`h-3 w-3 rounded-full ${
                  isConnected ? "bg-success animate-pulse" : "bg-muted"
                }`}
              />
              <span className="text-sm text-muted-foreground">
                {isConnected ? (isRecording ? "Listening..." : "Connected") : "Disconnected"}
              </span>
            </div>
          </div>

          <VoiceVisualizer isActive={isConnected} isSpeaking={isSpeaking} />

          <TranscriptDisplay transcript={transcript} />

          <div className="flex justify-center gap-4 mt-6">
            <Button
              onClick={toggleConnection}
              variant={isConnected ? "destructive" : "default"}
              size="lg"
              className="min-w-[200px]"
            >
              {isConnected ? (
                <>
                  <MicOff className="h-5 w-5 mr-2" />
                  Disconnect
                </>
              ) : (
                <>
                  <Mic className="h-5 w-5 mr-2" />
                  Start Voice Chat
                </>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default VoiceOnboarding;
