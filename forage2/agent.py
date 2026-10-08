import datetime
import json
import logging
import math
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
- STEM TUTOR & TEACHER: Explain complex mathematical equations, physics problems (projectile motion, vectors, forces), circuit diagrams, algorithms, and code clearly and step-by-step.
- INTERACTIVE TEACHER WHITEBOARD ACCESS: You have direct access to the live Teacher Whiteboard. When a student asks about physics, projectile motion, vectors, math equations, or algorithms, or asks you to solve what they drew, ALWAYS use your whiteboard drawing tools (draw_projectile_motion, draw_vector_diagram, draw_free_body_diagram, draw_circuit_diagram, write_on_whiteboard) to illustrate the diagrams, vectors, and solved formulas on the board in real time!
- ACCESSIBLE NOTE-MAKER: Synthesize live lecture speech and board visuals into structured, clean, bulleted study notes and revision plans.
- REAL-TIME MULTIMODAL ASSISTANT: Resolve spatial/visual references like "this equation", "my projectile drawing", or "that circuit" by bridging audio with visual whiteboard data.

==================================================
2. STRICT FORMATTING & RESPONSE RULES (CRITICAL)
==================================================
- NO LONG PARAGRAPHS: NEVER output dense, continuous paragraph blocks.
- BULLET-POINT STRUCTURE: Always break down answers into short, bite-sized bullet points or numbered steps.
- BREVITY FOR TTS: Keep voice responses concise (2 to 4 short sentences maximum per turn) so speech output remains clear and easy to follow.
- VISUAL SEPARATION: Use bolding for key terms and place double line breaks between distinct points.
- CODE & MATH: Format all code inside clean standard markdown code blocks with language identifiers (e.g. ```python ... ```) with full indentation and proper line breaks so the VS Code Studio can render it. Format mathematical formulas using clean readable notation or LaTeX.
- WHITEBOARD TOOLS: Actively call draw_projectile_motion, draw_vector_diagram, draw_free_body_diagram, draw_circuit_diagram, or write_on_whiteboard whenever explaining a visual STEM concept or when the student shows/asks about their whiteboard drawing!

==================================================
3. IN-CLASS INTERACTION MODES
==================================================
- TEACHING MODE: When asked a question, give a direct 1-sentence summary first, followed by 2-3 structured bullet points explaining "Why" or "How", and illustrate on the whiteboard.
- PROJECTILE MOTION & VECTORS: When asked about projectile motion or vectors, calculate the velocity components (u_x = u·cosθ, u_y = u·sinθ), max height H_max = (u_y)²/(2g), flight time T = 2u_y/g, and range R = u_x·T, explain them concisely, and call draw_projectile_motion or draw_vector_diagram!
- NOTE-TAKING MODE: When requested to take notes or summarize, format output as:
  • Key Takeaway
  • Core Formula / Concept
  • Step-by-Step Breakdown
- PRIVATE SIDE-CHAT: Answer student queries mid-lecture concisely without distracting from the main classroom flow.

==================================================
4. EXAMPLE RESPONSES
==================================================
[User Question]: "Can you solve this projectile motion on the whiteboard?"
[Your Action]: Call draw_projectile_motion(initial_velocity=25.0, angle_degrees=45.0)
[Your Output]:
I have drawn and solved the projectile motion trajectory on your whiteboard!

• Launch Velocity (u): 25.0 m/s at 45.0°
• Horizontal Component: u_x = 17.68 m/s (constant velocity)
• Vertical Component: u_y = 17.68 m/s (governed by gravity g = 9.8 m/s²)
• Peak Height (H_max): 15.94 meters
• Total Range (R): 63.78 meters | Flight Time (T): 3.61 seconds

Would you like me to adjust the launch angle or calculate velocity at a specific time?
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
            instructions="Warmly introduce yourself as OmniLearn AI, the STEM tutor and accessibility companion with interactive Teacher Whiteboard and VS Code Studio. Ask what concept, equation, or drawing they'd like help with today."
        )

    @function_tool
    async def draw_projectile_motion(
        self,
        context: RunContext,
        initial_velocity: float = 25.0,
        angle_degrees: float = 45.0,
        gravity: float = 9.8,
        title: str = "Projectile Motion Analysis",
    ) -> str:
        """Draw and solve projectile motion with parabolic trajectory, vector resolution (u, u_x, u_y), apex marker, Range, and step-by-step formulas on the teacher whiteboard.
        
        Args:
            initial_velocity: Initial launch speed u in m/s (e.g. 20, 25, 30).
            angle_degrees: Launch angle theta in degrees (e.g. 30, 45, 60).
            gravity: Acceleration due to gravity in m/s^2 (default 9.8).
            title: Title for the whiteboard diagram.
        """
        g = max(0.1, gravity)
        v = max(0.1, initial_velocity)
        ang = max(1.0, min(89.0, angle_degrees))
        rad = math.radians(ang)
        ux = v * math.cos(rad)
        uy = v * math.sin(rad)
        t_flight = (2 * uy) / g
        h_max = (uy ** 2) / (2 * g)
        r_range = (v ** 2 * math.sin(2 * rad)) / g

        payload = {
            "action": "draw",
            "diagram": "projectile_motion",
            "title": title,
            "velocity": round(v, 2),
            "angle": round(ang, 1),
            "gravity": round(g, 2),
            "ux": round(ux, 2),
            "uy": round(uy, 2),
            "t_flight": round(t_flight, 2),
            "h_max": round(h_max, 2),
            "range": round(r_range, 2),
        }

        # Send drawing command to client whiteboard
        try:
            raw_bytes = json.dumps(payload).encode("utf-8")
            if context.room:
                await context.room.local_participant.publish_data(raw_bytes, topic="lk.board", reliable=True)
        except Exception as e:
            logger.warning(f"Failed to publish projectile command: {e}")

        return (
            f"I have drawn the projectile motion trajectory and vector components on the whiteboard!\n\n"
            f"• Launch Velocity (u): {v:.1f} m/s at {ang:.1f}°\n"
            f"• Horizontal Velocity (u_x = u·cosθ): {ux:.2f} m/s (constant)\n"
            f"• Vertical Velocity (u_y = u·sinθ): {uy:.2f} m/s (under gravity g={g:.1f}m/s²)\n"
            f"• Maximum Height (H_max): {h_max:.2f} meters\n"
            f"• Total Time of Flight (T): {t_flight:.2f} seconds\n"
            f"• Total Horizontal Range (R): {r_range:.2f} meters"
        )

    @function_tool
    async def draw_vector_diagram(
        self,
        context: RunContext,
        vector_a_mag: float = 12.0,
        vector_a_deg: float = 30.0,
        vector_b_mag: float = 16.0,
        vector_b_deg: float = 90.0,
        title: str = "Vector Resolution & Addition",
    ) -> str:
        """Draw 2D vector resolution, coordinate axes, parallelogram addition, and resultant vector R on the whiteboard.
        
        Args:
            vector_a_mag: Magnitude of Vector A.
            vector_a_deg: Angle of Vector A in degrees from positive X-axis.
            vector_b_mag: Magnitude of Vector B.
            vector_b_deg: Angle of Vector B in degrees from positive X-axis.
            title: Title for the whiteboard diagram.
        """
        rad_a = math.radians(vector_a_deg)
        rad_b = math.radians(vector_b_deg)
        ax = vector_a_mag * math.cos(rad_a)
        ay = vector_a_mag * math.sin(rad_a)
        bx = vector_b_mag * math.cos(rad_b)
        by = vector_b_mag * math.sin(rad_b)
        rx = ax + bx
        ry = ay + by
        r_mag = math.sqrt(rx ** 2 + ry ** 2)
        r_deg = math.degrees(math.atan2(ry, rx))
        if r_deg < 0:
            r_deg += 360

        payload = {
            "action": "draw",
            "diagram": "vector_addition",
            "title": title,
            "ax": round(ax, 2), "ay": round(ay, 2), "amag": round(vector_a_mag, 2), "adeg": round(vector_a_deg, 1),
            "bx": round(bx, 2), "by": round(by, 2), "bmag": round(vector_b_mag, 2), "bdeg": round(vector_b_deg, 1),
            "rx": round(rx, 2), "ry": round(ry, 2), "rmag": round(r_mag, 2), "rdeg": round(r_deg, 1),
        }

        try:
            raw_bytes = json.dumps(payload).encode("utf-8")
            if context.room:
                await context.room.local_participant.publish_data(raw_bytes, topic="lk.board", reliable=True)
        except Exception as e:
            logger.warning(f"Failed to publish vector command: {e}")

        return (
            f"I have drawn the vector coordinate diagram and resultant vector R on the whiteboard!\n\n"
            f"• Vector A: {vector_a_mag:.1f} at {vector_a_deg:.1f}° (Ax = {ax:.2f}, Ay = {ay:.2f})\n"
            f"• Vector B: {vector_b_mag:.1f} at {vector_b_deg:.1f}° (Bx = {bx:.2f}, By = {by:.2f})\n"
            f"• Resultant Vector R (A + B): Magnitude = {r_mag:.2f} at {r_deg:.1f}° (Rx = {rx:.2f}, Ry = {ry:.2f})"
        )

    @function_tool
    async def draw_free_body_diagram(
        self,
        context: RunContext,
        mass_kg: float = 10.0,
        incline_angle_deg: float = 30.0,
        friction_coeff: float = 0.2,
        gravity: float = 9.8,
    ) -> str:
        """Draw a Free Body Force Diagram (FBD) of a mass on an inclined plane with gravity (mg), Normal force (N), and Friction (f) vectors.
        
        Args:
            mass_kg: Mass of object in kg.
            incline_angle_deg: Angle of incline in degrees.
            friction_coeff: Coefficient of friction mu (e.g. 0.1, 0.2, 0.3).
            gravity: Acceleration due to gravity (default 9.8 m/s^2).
        """
        rad = math.radians(incline_angle_deg)
        w = mass_kg * gravity
        n_force = w * math.cos(rad)
        f_down = w * math.sin(rad)
        f_friction = friction_coeff * n_force
        f_net = f_down - f_friction
        accel = f_net / mass_kg

        payload = {
            "action": "draw",
            "diagram": "free_body",
            "mass": mass_kg,
            "angle": incline_angle_deg,
            "mu": friction_coeff,
            "weight": round(w, 2),
            "normal": round(n_force, 2),
            "friction": round(f_friction, 2),
            "downhill": round(f_down, 2),
            "net_force": round(f_net, 2),
            "accel": round(accel, 2),
        }

        try:
            raw_bytes = json.dumps(payload).encode("utf-8")
            if context.room:
                await context.room.local_participant.publish_data(raw_bytes, topic="lk.board", reliable=True)
        except Exception as e:
            logger.warning(f"Failed to publish FBD command: {e}")

        return (
            f"I have drawn the Free Body Force Diagram on the whiteboard!\n\n"
            f"• Mass: {mass_kg} kg on {incline_angle_deg}° Incline\n"
            f"• Gravity Force (W = mg): {w:.2f} N downward\n"
            f"• Normal Force (N = mg·cosθ): {n_force:.2f} N perpendicular\n"
            f"• Downhill Gravity Component: {f_down:.2f} N along slope\n"
            f"• Friction Force (f = μN): {f_friction:.2f} N opposing motion\n"
            f"• Net Acceleration: {accel:.2f} m/s² down the slope"
        )

    @function_tool
    async def draw_circuit_diagram(
        self,
        context: RunContext,
        voltage_volts: float = 12.0,
        resistance_ohms: float = 4.0,
        title: str = "Ohm's Law Circuit Analysis",
    ) -> str:
        """Draw an electrical circuit diagram on the whiteboard with voltage source, resistor, current flow direction, and Ohm's Law calculations.
        
        Args:
            voltage_volts: Voltage V in volts (e.g. 5, 9, 12, 24).
            resistance_ohms: Resistance R in ohms (e.g. 2, 4, 10, 100).
            title: Title for the circuit diagram.
        """
        r = max(0.001, resistance_ohms)
        current = voltage_volts / r
        power = voltage_volts * current

        payload = {
            "action": "draw",
            "diagram": "circuit",
            "title": title,
            "voltage": round(voltage_volts, 2),
            "resistance": round(r, 2),
            "current": round(current, 3),
            "power": round(power, 3),
        }

        try:
            raw_bytes = json.dumps(payload).encode("utf-8")
            if context.room:
                await context.room.local_participant.publish_data(raw_bytes, topic="lk.board", reliable=True)
        except Exception as e:
            logger.warning(f"Failed to publish circuit command: {e}")

        return (
            f"I have drawn the circuit schematic on the whiteboard!\n\n"
            f"• Applied Voltage (V): {voltage_volts:.1f} V\n"
            f"• Circuit Resistance (R): {r:.1f} Ω\n"
            f"• Resulting Current (I = V/R): {current:.3f} A\n"
            f"• Power Dissipated (P = V·I): {power:.3f} Watts"
        )

    @function_tool
    async def write_on_whiteboard(
        self,
        context: RunContext,
        title: str,
        formula: str = "",
        steps: str = "",
        color: str = "#00e5ff",
    ) -> str:
        """Write custom teacher notes, equations, step-by-step math solutions, and explanations directly onto the whiteboard canvas.
        
        Args:
            title: Main title or header to write on the board.
            formula: Primary equation or formula.
            steps: Step-by-step solving steps or bullet points (separate lines with '\\n').
            color: Hex color for highlight (e.g. #00e5ff, #10b981, #f59e0b, #a855f7).
        """
        payload = {
            "action": "write",
            "diagram": "custom_lecture",
            "title": title,
            "formula": formula,
            "steps": steps,
            "color": color,
        }
        try:
            raw_bytes = json.dumps(payload).encode("utf-8")
            if context.room:
                await context.room.local_participant.publish_data(raw_bytes, topic="lk.board", reliable=True)
        except Exception as e:
            logger.warning(f"Failed to publish whiteboard text: {e}")

        return f"I have written the lecture notes and formulas for '{title}' onto the whiteboard."

    @function_tool
    async def clear_whiteboard(self, context: RunContext) -> str:
        """Clear all drawings and text from the teacher whiteboard."""
        payload = {"action": "clear"}
        try:
            raw_bytes = json.dumps(payload).encode("utf-8")
            if context.room:
                await context.room.local_participant.publish_data(raw_bytes, topic="lk.board", reliable=True)
        except Exception as e:
            logger.warning(f"Failed to clear board: {e}")

        return "I have cleared the whiteboard. It is ready for new diagrams and math problems."


server = AgentServer()


@server.rtc_session()
async def entrypoint(ctx: JobContext) -> None:
    ctx.log_context_fields = {
        "room": ctx.room.name,
    }
    logger.info(f"OmniLearn Agent entering room: {ctx.room.name}")

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
            logger.info(f"Received data on topic '{topic}': {raw[:160]}")

            if topic in ["lk.board_analysis", "board_analysis"]:
                try:
                    data_json = json.loads(raw)
                    query = data_json.get("query", "Please analyze my drawing on the whiteboard and solve it.")
                    diagram_type = data_json.get("diagram_type", "projectile_motion")
                    est_angle = data_json.get("estimated_angle", 45)
                    est_velocity = data_json.get("estimated_velocity", 25)
                    user_prompt = (
                        f"[Whiteboard Drawing Scan]: The student has drawn a {diagram_type} diagram on the whiteboard "
                        f"(estimated angle ~{est_angle}°, estimated velocity ~{est_velocity} m/s). "
                        f"Student Query: '{query}'. "
                        f"Please analyze the diagram, call your appropriate whiteboard tool (e.g. draw_projectile_motion, draw_vector_diagram, draw_free_body_diagram, or write_on_whiteboard) "
                        f"to illustrate the solved trajectory, vectors, and formulas directly on the whiteboard, and give a concise spoken explanation."
                    )
                except Exception:
                    user_prompt = f"[Whiteboard Drawing Scan]: {raw}. Please analyze and draw the solution on the whiteboard."

                logger.info(f"Dispatching Whiteboard Analysis Prompt: {user_prompt[:120]}...")
                session.generate_reply(user_input=user_prompt)

            elif topic in ["lk.chat", "lk-chat", "chat", ""]:
                try:
                    data_json = json.loads(raw)
                    msg_text = data_json.get("message", raw)
                except Exception:
                    msg_text = raw

                if msg_text and str(msg_text).strip():
                    logger.info(f"Received text chat message: {msg_text}")
                    session.generate_reply(user_input=str(msg_text).strip())

        except Exception as e:
            logger.warning(f"Error handling incoming data: {e}")

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

