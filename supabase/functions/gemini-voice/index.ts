import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");

const stagePrompts: Record<number, string> = {
  1: `You are Maya, a friendly onboarding assistant for NxtWave's CCBP 4.0 program. Welcome the user warmly and introduce yourself. Explain that you'll guide them through understanding the program. Ask their name and what brings them here today. Keep responses under 3 sentences.`,
  2: `You are Maya. Explain NxtWave's CCBP 4.0 program value: it's an intensive 6-month training program that transforms complete beginners into industry-ready developers. Highlight that 100% placement assistance is provided. Ask if they have any questions about the program structure.`,
  3: `You are Maya. Explain the payment structure: The program fee is ₹3,00,000. However, students can start with just ₹30,000 upfront through the ISA model. The remaining amount is paid as a percentage of salary after getting placed (only when earning above ₹3 LPA). Ask if this sounds feasible to them.`,
  4: `You are Maya. Check scholarship eligibility. Ask: 1) Are they a recent graduate or final year student? 2) Do they have any prior coding experience? 3) Their current academic background. Explain that scholarships up to 30% are available based on profile. Provide encouraging feedback.`,
  5: `You are Maya. Present EMI options for the ₹30,000 upfront payment: Option A: Pay in full (no interest). Option B: 3 months EMI (₹11,000/month). Option C: 6 months EMI (₹5,700/month). Ask which option works best for their financial situation.`,
  6: `You are Maya. Explain required documents: 1) Government ID proof (Aadhaar/PAN), 2) Latest educational certificates, 3) Income proof or parent's income proof for scholarship, 4) Bank account details for EMI setup. Ask if they have these ready or need time to arrange them.`,
  7: `You are Maya. Congratulate them on completing the onboarding! Summarize: They'll receive an email with enrollment link, document upload portal access, and counselor contact. The next cohort starts in 2 weeks. Express excitement about their journey. Ask if they have any final questions.`,
};

serve(async (req) => {
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  let currentStage = 1;
  let geminiWs: WebSocket | null = null;
  let conversationHistory: any[] = [];

  socket.onopen = () => {
    console.log("Client WebSocket connected");
  };

  socket.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log("Received from client:", message);

      if (message.type === "setup") {
        currentStage = message.stage || 1;
        const stageName = message.stageName || "Welcome";
        
        // Connect to Gemini
        const geminiUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${GOOGLE_API_KEY}`;
        geminiWs = new WebSocket(geminiUrl);

        geminiWs.onopen = () => {
          console.log("Connected to Gemini");
          
          // Setup with system instructions
          const setupMessage = {
            setup: {
              model: "models/gemini-2.0-flash-exp",
              generation_config: {
                response_modalities: ["AUDIO"],
                speech_config: {
                  voice_config: {
                    prebuilt_voice_config: {
                      voice_name: "Puck"
                    }
                  }
                }
              },
              system_instruction: {
                parts: [{
                  text: stagePrompts[currentStage] || stagePrompts[1]
                }]
              }
            }
          };
          
          geminiWs?.send(JSON.stringify(setupMessage));
          console.log("Sent setup to Gemini for stage:", stageName);
        };

        geminiWs.onmessage = (geminiEvent) => {
          try {
            const data = JSON.parse(geminiEvent.data);
            console.log("Received from Gemini:", data);

            if (data.serverContent?.modelTurn?.parts) {
              const parts = data.serverContent.modelTurn.parts;
              
              // Handle text response
              const textPart = parts.find((p: any) => p.text);
              if (textPart) {
                socket.send(JSON.stringify({
                  type: "transcript",
                  role: "assistant",
                  text: textPart.text
                }));
                conversationHistory.push({ role: "model", text: textPart.text });
              }

              // Handle audio response
              const audioPart = parts.find((p: any) => p.inlineData?.mimeType === "audio/pcm");
              if (audioPart) {
                socket.send(JSON.stringify({
                  type: "audio",
                  data: audioPart.inlineData.data
                }));
              }
            }

            // Check for turn complete
            if (data.serverContent?.turnComplete) {
              console.log("Turn complete");
            }
          } catch (error) {
            console.error("Error processing Gemini message:", error);
          }
        };

        geminiWs.onerror = (error) => {
          console.error("Gemini WebSocket error:", error);
          socket.send(JSON.stringify({ type: "error", message: "Gemini connection error" }));
        };

        geminiWs.onclose = () => {
          console.log("Gemini WebSocket disconnected");
        };
      } else if (message.type === "audio" && geminiWs) {
        // Forward audio to Gemini
        geminiWs.send(JSON.stringify({
          client_content: {
            turns: [{
              role: "user",
              parts: [{
                inline_data: {
                  mime_type: "audio/pcm",
                  data: message.data
                }
              }]
            }],
            turn_complete: true
          }
        }));
      } else if (message.type === "text" && geminiWs) {
        // Forward text to Gemini
        conversationHistory.push({ role: "user", text: message.text });
        
        socket.send(JSON.stringify({
          type: "transcript",
          role: "user",
          text: message.text
        }));

        geminiWs.send(JSON.stringify({
          client_content: {
            turns: [{
              role: "user",
              parts: [{ text: message.text }]
            }],
            turn_complete: true
          }
        }));
      }
    } catch (error) {
      console.error("Error handling client message:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      socket.send(JSON.stringify({ type: "error", message: errorMessage }));
    }
  };

  socket.onclose = () => {
    console.log("Client WebSocket disconnected");
    geminiWs?.close();
  };

  socket.onerror = (error) => {
    console.error("Client WebSocket error:", error);
    geminiWs?.close();
  };

  return response;
});
