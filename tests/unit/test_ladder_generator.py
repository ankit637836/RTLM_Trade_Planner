# tests/unit/test_ladder_generator.py

"""Tests for ladder generation."""

import pytest
from src.services.LadderGenerator import LadderGenerator

class TestLadderGenerator:
    
    def test_buy_ladder_generation(self):
        """Test generating a BUY ladder."""
        ladder = LadderGenerator.generate(
            start_price=99.50,
            stop_price=99.40,
            interval=0.01,
            direction="BUY"
        )
        
        # Should have 11 levels: 99.50, 99.49, ..., 99.40
        assert len(ladder) == 11
        assert ladder[0] == 99.50
        assert ladder[-1] == 99.40
        assert ladder[1] == 99.49
    
    def test_sell_ladder_generation(self):
        """Test generating a SELL ladder."""
        ladder = LadderGenerator.generate(
            start_price=100.10,
            stop_price=100.20,
            interval=0.01,
            direction="SELL"
        )
        
        assert len(ladder) == 11
        assert ladder[0] == 100.10
        assert ladder[-1] == 100.20
    
    def test_invalid_interval(self):
        """Test that zero/negative interval raises error."""
        with pytest.raises(ValueError):
            LadderGenerator.generate(99.50, 99.40, 0, "BUY")
        
        with pytest.raises(ValueError):
            LadderGenerator.generate(99.50, 99.40, -0.01, "BUY")
    
    def test_invalid_buy_prices(self):
        """Test that invalid BUY price range raises error."""
        with pytest.raises(ValueError):
            # For BUY, start must be > stop
            LadderGenerator.generate(99.40, 99.50, 0.01, "BUY")
    
    def test_invalid_sell_prices(self):
        """Test that invalid SELL price range raises error."""
        with pytest.raises(ValueError):
            # For SELL, start must be < stop
            LadderGenerator.generate(100.20, 100.10, 0.01, "SELL")
