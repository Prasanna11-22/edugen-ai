from fastapi import APIRouter
from ..services.eval_runner import run_5_stress_tests

router = APIRouter(prefix="/api/eval", tags=["Evaluation Suite"])

@router.get("/run-stress-tests")
def execute_eval_suite():
    """
    Runs and returns results for all 5 required evaluation stress tests (§8 & §11).
    """
    tests = run_5_stress_tests()
    passed_count = sum(1 for t in tests if t["passed"])
    return {
        "status": "success",
        "total_tests": len(tests),
        "passed_tests": passed_count,
        "all_passed": passed_count == len(tests),
        "test_cases": tests
    }
