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


class NovaAgent(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions=(
                "You are Nova, an intelligent, empathetic, and ultra-responsive voice assistant. "
                "You interact with users through real-time natural voice conversation. "
                "Keep your answers concise, direct, engaging, and clear. "
                "Do NOT use markdown symbols, bullet lists, emojis, asterisks, or formatting that sounds awkward when spoken aloud. "
                "Speak in a natural, conversational, friendly, and helpful tone."
            ),
            tools=[EndCallTool()],
        )

    async def on_enter(self) -> None:
        # Greet user immediately when joining the session
        self.session.generate_reply(
            instructions="Warmly introduce yourself as Nova and ask how you can help today."
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
        agent=NovaAgent(),
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(),
            text_input=room_io.TextInputOptions(),
            text_output=room_io.TextOutputOptions(),
        ),
    )


if __name__ == "__main__":
    cli.run_app(server)
