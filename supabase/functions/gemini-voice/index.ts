import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");

const stagePrompts: Record<number, string> = {
  1: `You are Maya, a friendly onboarding assistant for NxtWave's CCBP 4.0 program. 
  
Introduce yourself warmly: "Hi! I'm Maya, your onboarding assistant. I'll help you finish everything quickly and easily. Congratulations on taking the next step toward your career journey! This will take just a few minutes — and by the end, you'll be fully ready to start learning."

Then ask: "Is this a good time to begin? Would you like me to explain what's coming next?"

Keep responses conversational, warm, and under 3 sentences at a time.`,

  2: `You are Maya. Explain NxtWave's program value clearly and engagingly.

Say: "In most colleges, students learn theory — like drawing an engine instead of driving it. But here at NxtWave, we make learning practical. Students build real projects that companies actually value."

Explain: "Our 6 Growth Cycles take students from complete beginner to job-ready, step-by-step. We start from scratch — no coding background needed. Students create 8-10 real-world projects by the end."

Ask: "Would you like to know more about how this process works, or shall we continue?"

Be enthusiastic and build excitement about the program.`,

  3: `You are Maya. Explain the payment structure clearly with all 4 options.

Say: "Let's talk about the investment. We have 4 flexible payment options to suit different needs."

Explain each:
1. Full Payment: ₹3,00,000 paid upfront with discount
2. Pay After Placement (ISA): Start with just ₹30,000. Pay remaining only after getting placed earning above ₹3 LPA
3. EMI Options: Split ₹30,000 into 3 or 6 months
4. Scholarship: Up to 30% discount based on profile

Ask: "Which payment option interests you most?" 

Be clear, patient, and helpful with financial details.`,

  4: `You are Maya checking scholarship eligibility.

Ask these questions one by one:
1. "Are you a recent graduate or final year student?"
2. "Do you have any prior coding experience?"
3. "What's your current academic background?"

Based on responses, provide encouraging feedback like: "That's great! You're potentially eligible for scholarships up to 30%. Our team will review your profile in detail."

Be supportive and encouraging throughout.`,

  5: `You are Maya presenting EMI options for the ₹30,000 upfront payment.

Present clearly:
- Option A: Pay ₹30,000 in full (no interest, easiest)
- Option B: 3 months EMI at ₹11,000/month (small interest)
- Option C: 6 months EMI at ₹5,700/month (more affordable monthly)

Ask: "Which option works best for your financial situation? There's no pressure — take your time to think."

Be understanding and patient with financial decisions.`,

  6: `You are Maya explaining required documents.

Say: "Almost there! To complete your enrollment, we'll need a few documents:"

List clearly:
1. Government ID proof (Aadhaar or PAN card)
2. Latest educational certificates
3. Income proof or parent's income proof (for scholarship)
4. Bank account details (for EMI setup)

Ask: "Do you have these ready, or would you like a few days to arrange them?"

Be helpful and accommodating.`,

  7: `You are Maya congratulating on completion!

Say enthusiastically: "Congratulations! You've completed the onboarding process! You're all set to begin your journey with NxtWave."

Summarize: "You'll receive an email shortly with:
- Your enrollment link
- Document upload portal access
- Your personal counselor's contact details

The next cohort starts in 2 weeks. We're excited to have you!"

Ask: "Do you have any final questions for me?"

Be warm, congratulatory, and helpful with any last questions.`,
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
  let isGeminiReady = false;

  socket.onopen = () => {
    console.log("Client WebSocket connected");
  };

  socket.onmessage = async (event) => {
    try {
      const message = JSON.parse(event.data);
      console.log("Received from client:", message.type);

      if (message.type === "setup") {
        currentStage = message.stage || 1;
        const stageName = message.stageName || "Welcome";
        console.log(`Setting up stage ${currentStage}: ${stageName}`);

        // Close existing Gemini connection if any
        if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
          geminiWs.close();
        }

        // Connect to Gemini LIVE API
        const geminiUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${GOOGLE_API_KEY}`;
        geminiWs = new WebSocket(geminiUrl);
        isGeminiReady = false;

        geminiWs.onopen = () => {
          console.log("Connected to Gemini LIVE API");

          // Send setup configuration
          const setupMessage = {
            setup: {
              model: "models/gemini-2.0-flash-exp",
              generation_config: {
                response_modalities: ["AUDIO"],
                speech_config: {
                  voice_config: {
                    prebuilt_voice_config: {
                      voice_name: "Puck",
                    },
                  },
                },
              },
              system_instruction: {
                parts: [
                  {
                    text: stagePrompts[currentStage] || stagePrompts[1],
                  },
                ],
              },
            },
          };

          geminiWs?.send(JSON.stringify(setupMessage));
          console.log("Sent setup to Gemini for stage:", stageName);
          isGeminiReady = true;
        };

        geminiWs.onmessage = async (geminiEvent) => {
          try {
            // Check if message is a Blob (binary audio data)
            if (geminiEvent.data instanceof Blob) {
              console.log("Received audio blob from Gemini");
              const arrayBuffer = await geminiEvent.data.arrayBuffer();
              
              // Convert arrayBuffer to base64 in chunks to avoid call stack size exceeded
              const uint8Array = new Uint8Array(arrayBuffer);
              let binary = '';
              const chunkSize = 0x8000; // 32KB chunks
              
              for (let i = 0; i < uint8Array.length; i += chunkSize) {
                const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
                binary += String.fromCharCode.apply(null, Array.from(chunk));
              }
              
              const base64Audio = btoa(binary);
              socket.send(
                JSON.stringify({
                  type: "audio",
                  data: base64Audio,
                })
              );
              return;
            }

            // Handle JSON messages
            const data = JSON.parse(geminiEvent.data);

            // Handle setup complete
            if (data.setupComplete) {
              console.log("Gemini setup complete");
              return;
            }

            if (data.serverContent?.modelTurn?.parts) {
              const parts = data.serverContent.modelTurn.parts;

              // Handle text response (for transcript)
              const textPart = parts.find((p: any) => p.text);
              if (textPart && textPart.text) {
                console.log("Gemini text:", textPart.text.substring(0, 50));
                socket.send(
                  JSON.stringify({
                    type: "transcript",
                    role: "assistant",
                    text: textPart.text,
                  })
                );
              }

              // Handle audio response
              const audioPart = parts.find(
                (p: any) => p.inlineData?.mimeType === "audio/pcm"
              );
              if (audioPart?.inlineData?.data) {
                socket.send(
                  JSON.stringify({
                    type: "audio",
                    data: audioPart.inlineData.data,
                  })
                );
              }
            }

            // Handle turn complete
            if (data.serverContent?.turnComplete) {
              console.log("Gemini turn complete");
            }
          } catch (error) {
            console.error("Error processing Gemini message:", error);
          }
        };

        geminiWs.onerror = (error) => {
          console.error("Gemini WebSocket error:", error);
          socket.send(
            JSON.stringify({
              type: "error",
              message: "Gemini connection error",
            })
          );
        };

        geminiWs.onclose = () => {
          console.log("Gemini WebSocket disconnected");
          isGeminiReady = false;
        };
      } else if (message.type === "audio" && geminiWs && isGeminiReady) {
        // Forward audio to Gemini
        geminiWs.send(
          JSON.stringify({
            realtimeInput: {
              mediaChunks: [
                {
                  mimeType: "audio/pcm",
                  data: message.data,
                },
              ],
            },
          })
        );
      }
    } catch (error) {
      console.error("Error handling client message:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      socket.send(JSON.stringify({ type: "error", message: errorMessage }));
    }
  };

  socket.onclose = () => {
    console.log("Client WebSocket disconnected");
    if (geminiWs) {
      geminiWs.close();
    }
  };

  socket.onerror = (error) => {
    console.error("Client WebSocket error:", error);
    if (geminiWs) {
      geminiWs.close();
    }
  };

  return response;
});
