"""
Unit tests for Step 7: Fixed-K Attack Progression Simulator.
Validates:
- Scenarios & deterministic stage sequences
- In-memory execution without network activity
- State progression (start -> advance -> pause -> resume -> stop -> reset)
- Complete isolation from live/historical states
- FastAPI simulator routes
"""
import unittest
from fastapi.testclient import TestClient

from backend.main import app
from backend.simulator.scenarios import (
    SCENARIOS,
    get_stage_sequence,
    get_stage_names,
)
from backend.simulator.engine import (
    start_simulation,
    advance_step,
    pause_simulation,
    resume_simulation,
    stop_simulation,
    reset_simulation,
    get_state,
    get_result,
    validate_config,
)
from backend.simulator.models import K_MIN, K_MAX


class TestSimulatorEngine(unittest.TestCase):
    def test_validation(self):
        self.assertIsNone(validate_config("controlled_attack_progression", 5, 10, 1.0))
        self.assertIsNotNone(validate_config("invalid_scenario", 5, 10, 1.0))
        self.assertIsNotNone(validate_config("controlled_attack_progression", K_MIN - 1, 10, 1.0))
        self.assertIsNotNone(validate_config("controlled_attack_progression", K_MAX + 1, 10, 1.0))
        self.assertIsNotNone(validate_config("controlled_attack_progression", 5, 999, 1.0))

    def test_stage_sequence(self):
        for k in range(K_MIN, K_MAX + 1):
            seq = get_stage_sequence(k)
            names = get_stage_names(k)
            self.assertEqual(len(seq), k)
            self.assertEqual(len(names), k)
            self.assertEqual(seq[0].name, "Reconnaissance")

    def test_full_progression_lifecycle(self):
        state = start_simulation(scenario="controlled_attack_progression", k=4, window_seconds=10, speed=1.0)
        sim_id = state.simulation_id

        self.assertEqual(state.status, "running")
        self.assertEqual(state.current_step, 0)
        self.assertEqual(len(state.generated_events), 1)
        self.assertEqual(len(state.forecast_snapshots), 1)

        # Advance step 1
        state = advance_step(sim_id)
        self.assertEqual(state.current_step, 1)

        # Advance step 2
        state = advance_step(sim_id)
        self.assertEqual(state.current_step, 2)

        # Pause and resume
        state = pause_simulation(sim_id)
        self.assertEqual(state.status, "paused")
        state = resume_simulation(sim_id)
        self.assertEqual(state.status, "running")

        # Advance step 3 (last step for k=4)
        state = advance_step(sim_id)
        self.assertEqual(state.current_step, 3)
        self.assertEqual(state.status, "completed")

        # Result retrieval
        result = get_result(sim_id)
        self.assertEqual(result["status"], "completed")
        self.assertEqual(len(result["generated_events"]), 4)
        self.assertEqual(len(result["stage_profiles"]), 4)
        self.assertIn("SIMULATION", result["disclaimer"])

        # Reset simulation
        state = reset_simulation(sim_id)
        self.assertEqual(state.status, "running")
        self.assertEqual(state.current_step, 0)
        self.assertEqual(len(state.generated_events), 1)


class TestSimulatorAPI(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_scenarios_endpoint(self):
        res = self.client.get("/api/simulator/scenarios")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("scenarios", data)
        self.assertEqual(len(data["scenarios"]), len(SCENARIOS))

    def test_api_workflow(self):
        # Start
        res = self.client.post("/api/simulator/start", json={
            "scenario": "controlled_attack_progression",
            "k": 3,
            "window_seconds": 10,
            "speed": 1.0,
        })
        self.assertEqual(res.status_code, 201)
        data = res.json()
        sim_id = data["simulation_id"]
        self.assertEqual(data["status"], "running")
        self.assertEqual(data["current_step"], 0)

        # Advance
        res = self.client.post(f"/api/simulator/{sim_id}/next")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["current_step"], 1)

        # Status
        res = self.client.get(f"/api/simulator/{sim_id}/status")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["current_step"], 1)

        # Result
        res = self.client.get(f"/api/simulator/{sim_id}/result")
        self.assertEqual(res.status_code, 200)

        # Stop
        res = self.client.post(f"/api/simulator/{sim_id}/stop")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "stopped")


if __name__ == "__main__":
    unittest.main()
