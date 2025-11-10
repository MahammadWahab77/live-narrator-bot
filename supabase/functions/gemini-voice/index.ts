import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY");

const stagePrompts: Record<number, string> = {
  1: `IMPORTANT: Speak in modern Telugu (Telangana dialect) with natural English code-mixing. Use 70% Telugu and 30% English. Mix English words naturally for technical terms, program names, and modern concepts.

You are Maya, a friendly onboarding assistant for NxtWave's CCBP 4.0 program.

Introduce yourself warmly in Telugu: "హాయ్! నేను Maya, మీ onboarding assistant. మీకు అన్నీ త్వరగా మరియు సులభంగా పూర్తి చేయడంలో సహాయం చేస్తాను. మీ career journey వైపు తదుపరి అడుగు వేసినందుకు అభినందనలు! ఇది కేవలం కొన్ని నిమిషాలు మాత్రమే పడుతుంది — మరియు చివరికి, మీరు learning start చేయడానికి పూర్తిగా ready అవుతారు."

Then ask: "ఇప్పుడు మొదలుపెట్టడానికి మంచి time నా? తరువాత ఏమి వస్తుందో నేను explain చేయాలా?"

Keep responses conversational, warm, and under 3 sentences at a time.`,

  2: `IMPORTANT: Speak in modern Telugu (Telangana dialect) with natural English code-mixing. Use 70% Telugu and 30% English.

You are Maya. Explain NxtWave's program value clearly and engagingly.

Say: "చాలా colleges లో, students theory నేర్చుకుంటారు — engine drive చేయడం కాకుండా draw చేయడం లాగా. కానీ NxtWave లో, మేము learning ని practical గా చేస్తాము. Students real projects build చేస్తారు, companies actually value చేసే projects."

Explain: "మా 6 Growth Cycles students ను complete beginner నుండి job-ready వరకు తీసుకువెళతాయి, step-by-step. మేము scratch నుండి start చేస్తాము — coding background అవసరం లేదు. చివరికి students 8-10 real-world projects create చేస్తారు."

Ask: "ఈ process ఎలా పని చేస్తుందో మరింత తెలుసుకోవాలనుకుంటున్నారా, లేదా continue చేయమంటారా?"

Be enthusiastic and build excitement about the program.`,

  3: `IMPORTANT: Speak in modern Telugu (Telangana dialect) with natural English code-mixing. Use 70% Telugu and 30% English.

You are Maya. Explain the payment structure clearly with all 4 options.

Say: "Investment గురించి మాట్లాడుకుందాం. మా దగ్గర 4 flexible payment options ఉన్నాయి, different needs కి suit అయ్యేలా."

Explain each:
1. Full Payment: ₹3,00,000 upfront pay చేస్తే discount తో
2. Pay After Placement (ISA): కేవలం ₹30,000 తో start చేయండి. Remaining amount placement వచ్చిన తర్వాత మాత్రమే, ₹3 LPA కంటే ఎక్కువ earn చేస్తే
3. EMI Options: ₹30,000 ని 3 లేదా 6 months లో split చేయండి
4. Scholarship: Profile base చేసి 30% వరకు discount

Ask: "ఏ payment option మీకు most interesting గా ఉంది?"

Be clear, patient, and helpful with financial details.`,

  4: `IMPORTANT: Speak in modern Telugu (Telangana dialect) with natural English code-mixing. Use 70% Telugu and 30% English.

You are Maya checking scholarship eligibility.

Ask these questions one by one:
1. "మీరు recent graduate నా లేదా final year student నా?"
2. "మీకు ఏదైనా prior coding experience ఉందా?"
3. "మీ current academic background ఏమిటి?"

Based on responses, provide encouraging feedback: "అది బాగుంది! మీరు potentially 30% వరకు scholarships కి eligible అవ్వవచ్చు. మా team మీ profile ని detail గా review చేస్తుంది."

Be supportive and encouraging throughout.`,

  5: `IMPORTANT: Speak in modern Telugu (Telangana dialect) with natural English code-mixing. Use 70% Telugu and 30% English.

You are Maya presenting EMI options for the ₹30,000 upfront payment.

Present clearly:
- Option A: ₹30,000 full గా pay చేయండి (no interest, easiest)
- Option B: 3 months EMI at ₹11,000/month (small interest)
- Option C: 6 months EMI at ₹5,700/month (more affordable monthly)

Ask: "ఏ option మీ financial situation కి best గా work అవుతుంది? Pressure ఏమీ లేదు — మీరు think చేసుకోవడానికి time తీసుకోండి."

Be understanding and patient with financial decisions.`,

  6: `IMPORTANT: Speak in modern Telugu (Telangana dialect) with natural English code-mixing. Use 70% Telugu and 30% English.

You are Maya explaining required documents.

Say: "దాదాపు అయిపోయింది! మీ enrollment complete చేయడానికి, మాకు కొన్ని documents అవసరం:"

List clearly:
1. Government ID proof (Aadhaar లేదా PAN card)
2. Latest educational certificates
3. Income proof లేదా parent's income proof (scholarship కోసం)
4. Bank account details (EMI setup కోసం)

Ask: "ఇవి ready గా ఉన్నాయా, లేదా arrange చేసుకోవడానికి కొన్ని days కావాలా?"

Be helpful and accommodating.`,

  7: `IMPORTANT: Speak in modern Telugu (Telangana dialect) with natural English code-mixing. Use 70% Telugu and 30% English.

You are Maya congratulating on completion!

Say enthusiastically: "అభినందనలు! మీరు onboarding process complete చేశారు! మీరు NxtWave తో మీ journey begin చేయడానికి పూర్తిగా set అయిపోయారు."

Summarize: "మీకు email వస్తుంది shortly తో:
- మీ enrollment link
- Document upload portal access
- మీ personal counselor's contact details

తరువాత cohort 2 weeks లో start అవుతుంది. మీరు join అవుతున్నందుకు మేము excited గా ఉన్నాము!"

Ask: "మీకు ఏదైనా final questions ఉన్నాయా?"

Be warm, congratulatory, and helpful with any last questions.`,
};

// Reconnection logic
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 2000;
let geminiWs: WebSocket | null = null;

async function reconnectToGemini(socket: WebSocket, currentStage: number, stageName: string, conversationHistory: any[]) {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    socket.send(JSON.stringify({
      type: "error",
      message: "Maya se reconnect nahi ho paya. Please refresh karke try karein."
    }));
    return null;
  }

  reconnectAttempts++;
  const delay = RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts - 1);
  
  console.log(`Reconnecting to Gemini (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in ${delay}ms`);
  
  socket.send(JSON.stringify({
    type: "info",
    message: "Maya se reconnect ho raha hai..."
  }));

  await new Promise(resolve => setTimeout(resolve, delay));
  
  return createGeminiConnection(socket, currentStage, stageName, conversationHistory);
}

function createGeminiConnection(socket: WebSocket, currentStage: number, stageName: string, conversationHistory: any[]): WebSocket {
  const geminiUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${GOOGLE_API_KEY}`;
  const ws = new WebSocket(geminiUrl);
  
  ws.onopen = () => {
    console.log("Connected to Gemini LIVE API");
    reconnectAttempts = 0;
    
    const contextPrompt = conversationHistory.length > 0 
      ? `\n\nPREVIOUS CONVERSATION CONTEXT:\n${conversationHistory.map(m => 
          `${m.role === 'user' ? 'User' : 'Maya'}: ${m.text}`
        ).join('\n')}\n\nContinue the conversation naturally from where you left off. Don't repeat yourself - acknowledge what was already discussed.`
      : '';
    
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
              text: (stagePrompts[currentStage] || stagePrompts[1]) + contextPrompt,
            },
          ],
        },
      },
    };

    ws.send(JSON.stringify(setupMessage));
    console.log(`Sent setup to Gemini for stage: ${stageName} with ${conversationHistory.length} previous messages`);
  };
  
  ws.onclose = async () => {
    console.log("Gemini WebSocket closed - attempting reconnect");
    const newWs = await reconnectToGemini(socket, currentStage, stageName, conversationHistory);
    if (newWs) {
      geminiWs = newWs;
    }
  };
  
  ws.onerror = (error) => {
    console.error("Gemini error:", error);
  };
  
  ws.onmessage = async (geminiEvent) => {
    try {
      if (geminiEvent.data instanceof Blob) {
        const text = await geminiEvent.data.text().catch(() => null);
        if (text) {
          try {
            const data = JSON.parse(text);
            
            if (data.setupComplete) {
              console.log("Gemini setup complete");
              return;
            }

            if (data.serverContent?.modelTurn?.parts) {
              const parts = data.serverContent.modelTurn.parts;

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

              const audioPart = parts.find(
                (p: any) => {
                  const mt = p.inlineData?.mimeType;
                  return typeof mt === "string" && mt.toLowerCase().startsWith("audio/pcm");
                }
              );
              if (audioPart?.inlineData?.data) {
                console.log("Forwarding inline PCM audio data");
                socket.send(
                  JSON.stringify({
                    type: "audio",
                    data: audioPart.inlineData.data,
                  })
                );
              }
            }

            if (data.serverContent?.turnComplete) {
              console.log("Gemini turn complete");
            }
            return;
          } catch {
            // Not JSON, treat as binary audio
          }
        }

        const arrayBuffer = await geminiEvent.data.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        if (uint8Array.length < 100) {
          console.log(`Skipping tiny blob (${uint8Array.length} bytes)`);
          return;
        }

        let binary = '';
        const chunkSize = 0x8000;
        
        for (let i = 0; i < uint8Array.length; i += chunkSize) {
          const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
          binary += String.fromCharCode.apply(null, Array.from(chunk));
        }
        
        const base64Audio = btoa(binary);
        console.log(`Forwarding PCM blob: ${uint8Array.length} bytes`);
        socket.send(
          JSON.stringify({
            type: "audio",
            data: base64Audio,
          })
        );
        return;
      }

      const data = JSON.parse(geminiEvent.data);

      if (data.setupComplete) {
        console.log("Gemini setup complete");
        return;
      }

      if (data.serverContent?.modelTurn?.parts) {
        const parts = data.serverContent.modelTurn.parts;

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

        const audioPart = parts.find(
          (p: any) => {
            const mt = p.inlineData?.mimeType;
            return typeof mt === "string" && mt.toLowerCase().startsWith("audio/pcm");
          }
        );
        if (audioPart?.inlineData?.data) {
          console.log("Forwarding inline PCM audio data");
          socket.send(
            JSON.stringify({
              type: "audio",
              data: audioPart.inlineData.data,
            })
          );
        }
      }

      if (data.serverContent?.turnComplete) {
        console.log("Gemini turn complete");
      }
    } catch (error) {
      console.error("Error processing Gemini message:", error);
    }
  };
  
  return ws;
}

serve(async (req) => {
  const { headers } = req;
  const upgradeHeader = headers.get("upgrade") || "";

  if (upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected WebSocket connection", { status: 400 });
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  let currentStage = 1;
  let conversationHistory: any[] = [];
  let isGeminiReady = false;
  let heartbeatInterval: number | null = null;

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
        conversationHistory = message.conversationHistory || [];
        console.log(`Setting up stage ${currentStage}: ${stageName} with ${conversationHistory.length} previous messages`);

        if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
          geminiWs.close();
        }

        geminiWs = createGeminiConnection(socket, currentStage, stageName, conversationHistory);
        isGeminiReady = true;
        
        // Start heartbeat
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000);
        
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
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
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
