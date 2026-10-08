import datetime
import json
import logging
import os
from pathlib import Path
from dotenv import load_dotenv

from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    MetricsCollectedEvent,
    RunContext,
    TurnHandlingOptions,
    cli,
    inference,
    metrics,
    room_io,
    text_transforms,
)
from livekit.agents.beta import EndCallTool
from livekit.agents.llm import function_tool

logger = logging.getLogger("forage2-voice-agent")

# Load environment variables from .env in current folder or parent
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)
load_dotenv()


SYSTEM_PROMPT = """
You are OmniLearn AI, a real-time multimodal accessibility companion and STEM tutor designed to assist students with visual, hearing, or learning disabilities in technical classrooms.

==================================================
1. CORE ROLE & CAPABILITIES
==================================================
- STEM TUTOR & TEACHER: Explain complex mathematical equations, circuit diagrams, algorithms, and code clearly and step-by-step.
- ACCESSIBLE NOTE-MAKER: Synthesize live lecture speech and board visuals into structured, clean, bulleted study notes and revision plans.
- REAL-TIME MULTIMODAL ASSISTANT: Resolve spatial/visual references like "this equation" or "that circuit" by bridging audio with visual board data.

==================================================
2. STRICT FORMATTING & RESPONSE RULES (CRITICAL)
==================================================
- NO LONG PARAGRAPHS: NEVER output dense, continuous paragraph blocks.
- BULLET-POINT STRUCTURE: Always break down answers into short, bite-sized bullet points or numbered steps.
- BREVITY FOR TTS: Keep voice responses concise (2 to 4 short sentences maximum per turn) so speech output remains clear and easy to follow.
- VISUAL SEPARATION: Use bolding for key terms and place double line breaks between distinct points.
- CODE & MATH: Format all code inside clean standard markdown code blocks with language identifiers (e.g. ```python ... ```) with full indentation and proper line breaks so the VS Code Studio can render it. Format mathematical formulas using clean readable notation or LaTeX.

==================================================
3. IN-CLASS INTERACTION MODES
==================================================
- TEACHING MODE: When asked a question, give a direct 1-sentence summary first, followed by 2-3 structured bullet points explaining "Why" or "How".
- NOTE-TAKING MODE: When requested to take notes or summarize, format output as:
  • Key Takeaway
  • Core Formula / Concept
  • Step-by-Step Breakdown
- PRIVATE SIDE-CHAT: Answer student queries mid-lecture concisely without distracting from the main classroom flow.

==================================================
4. EXAMPLE RESPONSES
==================================================
[User Question]: "Explain Ohm's Law."
[Your Output]:
Ohm's Law defines the relationship between Voltage, Current, and Resistance in a circuit.

• Formula: V = I × R
• Voltage (V): The electrical push measured in Volts.
• Current (I): The flow of charge measured in Amperes.
• Resistance (R): The opposition to flow measured in Ohms.

Would you like a circuit example or a quick practice problem?
"""


class OmniLearnAgent(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions=SYSTEM_PROMPT,
            tools=[EndCallTool()],
        )

    async def on_enter(self) -> None:
        # Greet student immediately when joining the session
        self.session.generate_reply(
            instructions="Warmly introduce yourself as OmniLearn AI, the STEM tutor and accessibility companion. Ask what concept, equation, or lecture topic they'd like help with today."
        )

    @function_tool
    async def get_current_time(self, context: RunContext) -> str:
        """Get the current system date and time."""
        now = datetime.datetime.now()
        return f"The current time is {now.strftime('%I:%M %p')} on {now.strftime('%A, %B %d, %Y')}."

    @function_tool
    async def lookup_weather(
        self, context: RunContext, location: str
    ) -> str:
        """Lookup current weather condition for a city or region.
        
        Args:
            location: The name of the city or region.
        """
        logger.info(f"Looking up weather for: {location}")
        return f"In {location}, the weather is currently sunny and pleasant at 72 degrees Fahrenheit (22 degrees Celsius) with a light breeze."


server = AgentServer()


@server.rtc_session()
async def entrypoint(ctx: JobContext) -> None:
    ctx.log_context_fields = {
        "room": ctx.room.name,
    }
    logger.info(f"Agent entering room: {ctx.room.name}")

    session: AgentSession = AgentSession(
        stt=inference.STT("deepgram/nova-3", language="multi"),
        llm=inference.LLM("openai/gpt-4.1-mini"),
        tts=inference.TTS("cartesia/sonic-3", voice="9626c31c-bec5-4cca-baa8-f8ba9e84c8bc"),
        turn_handling=TurnHandlingOptions(
            interruption={
                "resume_false_interruption": True,
                "false_interruption_timeout": 1.0,
            },
            preemptive_generation={"enabled": True, "max_retries": 3},
        ),
        aec_warmup_duration=2.0,
        tts_text_transforms=[
            "filter_emoji",
            "filter_markdown",
            text_transforms.replace({"LiveKit": "<<ˈ|l|aɪ|v|k|ɪ|t>>"}),
        ],
    )

    @session.on("metrics_collected")
    def _on_metrics_collected(ev: MetricsCollectedEvent) -> None:
        if ev.metrics.type == "stt_metrics":
            return
        metrics.log_metrics(ev.metrics)

    async def log_usage():
        logger.info(f"Session finished. Usage: {session.usage}")

    ctx.add_shutdown_callback(log_usage)

    @ctx.room.on("data_received")
    def _on_data_received(dp) -> None:
        try:
            raw = dp.data.decode("utf-8")
            topic = getattr(dp, "topic", "")
            if topic in ["lk.chat", "lk-chat", "chat", ""]:
                try:
                    data_json = json.loads(raw)
                    msg_text = data_json.get("message", raw)
                except Exception:
                    msg_text = raw
                if msg_text and str(msg_text).strip():
                    logger.info(f"Received text chat message: {msg_text}")
                    session.generate_reply(user_input=str(msg_text).strip())
        except Exception as e:
            logger.warning(f"Error handling chat data: {e}")

    await session.start(
        agent=OmniLearnAgent(),
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(),
            text_input=room_io.TextInputOptions(),
            text_output=room_io.TextOutputOptions(),
        ),
    )


if __name__ == "__main__":
    cli.run_app(server)
