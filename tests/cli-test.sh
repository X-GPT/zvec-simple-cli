#!/bin/bash
set -e

ZDOC="zdoc"
PASS=0
FAIL=0

TESTDIR=$(mktemp -d)
trap 'rm -rf "$TESTDIR"' EXIT

run_test() {
  local name="$1"
  shift
  echo -n "TEST: $name ... "
  if output=$("$@" 2>&1); then
    echo "PASS"
    PASS=$((PASS + 1))
  else
    echo "FAIL"
    echo "  Output: $output"
    FAIL=$((FAIL + 1))
  fi
}

run_test_expect_fail() {
  local name="$1"
  shift
  echo -n "TEST: $name ... "
  if "$@" >/dev/null 2>&1; then
    echo "FAIL (expected non-zero exit)"
    FAIL=$((FAIL + 1))
  else
    echo "PASS"
    PASS=$((PASS + 1))
  fi
}

run_test_grep() {
  local name="$1"
  local pattern="$2"
  shift 2
  echo -n "TEST: $name ... "
  if output=$("$@" 2>&1) && echo "$output" | grep -q "$pattern"; then
    echo "PASS"
    PASS=$((PASS + 1))
  else
    echo "FAIL (expected pattern: $pattern)"
    echo "  Output: $output"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== zdoc CLI Tests ==="
echo ""

# Help / usage
run_test_expect_fail "no args shows usage" $ZDOC
run_test_expect_fail "unknown command fails" $ZDOC unknown

# Status (empty state)
run_test_grep "status shows zero partitions" "Partitions: 0" $ZDOC status
run_test_grep "status --json" '"partitions":0' $ZDOC status --json

# Partition list (empty)
run_test_grep "partition list empty" "No partitions" $ZDOC partition list
run_test_grep "partition list --json empty" '"partitions":\[\]' $ZDOC partition list --json

# Create test files
echo "The quick brown fox jumps over the lazy dog." > $TESTDIR/doc1.txt
echo "Vector databases store embeddings for similarity search." > $TESTDIR/doc2.txt

# Partition add (will fail without OPENAI_API_KEY, but should fail gracefully)
run_test_expect_fail "partition add without API key" $ZDOC partition add $TESTDIR --name test

# Partition remove non-existent
run_test_expect_fail "partition remove non-existent" $ZDOC partition remove --name nonexistent

# Missing required args
run_test_expect_fail "partition add missing --name" $ZDOC partition add $TESTDIR
run_test_expect_fail "partition add missing path" $ZDOC partition add --name test
run_test_expect_fail "search missing query" $ZDOC search

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
exit $FAIL
