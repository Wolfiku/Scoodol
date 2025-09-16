"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Calculator() {
  const [display, setDisplay] = useState('0');
  const [firstOperand, setFirstOperand] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForSecondOperand, setWaitingForSecondOperand] = useState(false);

  const inputDigit = (digit: string) => {
    if (waitingForSecondOperand) {
      setDisplay(digit);
      setWaitingForSecondOperand(false);
    } else {
      setDisplay(display === '0' ? digit : display + digit);
    }
  };

  const inputDecimal = () => {
    if (waitingForSecondOperand) {
      setDisplay('0.');
      setWaitingForSecondOperand(false);
      return;
    }
    if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const clearDisplay = () => {
    setDisplay('0');
    setFirstOperand(null);
    setOperator(null);
    setWaitingForSecondOperand(false);
  };

  const performOperation = (nextOperator: string) => {
    const inputValue = parseFloat(display);

    if (firstOperand === null) {
      setFirstOperand(inputValue);
    } else if (operator) {
      const result = calculate(firstOperand, inputValue, operator);
      setDisplay(String(result));
      setFirstOperand(result);
    }

    setWaitingForSecondOperand(true);
    setOperator(nextOperator);
  };
  
  const handleEquals = () => {
    const inputValue = parseFloat(display);
    if (operator && firstOperand !== null) {
      const result = calculate(firstOperand, inputValue, operator);
      setDisplay(String(result));
      setFirstOperand(result); // Allows for continuous calculations
      setOperator(null);
      setWaitingForSecondOperand(true);
    }
  };

  const calculate = (first: number, second: number, op: string) => {
    switch (op) {
      case '+':
        return first + second;
      case '-':
        return first - second;
      case '*':
        return first * second;
      case '/':
        return first / second;
      default:
        return second;
    }
  };
  
  const toggleSign = () => {
    setDisplay(String(parseFloat(display) * -1));
  };
  
  const inputPercent = () => {
     setDisplay(String(parseFloat(display) / 100));
  }

  const renderButton = (label: string, onClick: () => void, className: string = '') => (
    <Button
      onClick={onClick}
      className={`h-16 text-2xl rounded-xl ${className}`}
      variant="outline"
    >
      {label}
    </Button>
  );
  
  return (
    <Card className="max-w-sm mx-auto">
        <CardHeader>
            <CardTitle>Taschenrechner</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="bg-muted text-right p-4 rounded-lg mb-4">
                <p className="text-4xl font-mono break-all">{display}</p>
            </div>
            <div className="grid grid-cols-4 gap-2">
                {renderButton(display === '0' ? 'AC' : 'C', clearDisplay, 'bg-accent text-accent-foreground col-span-1')}
                {renderButton('+/-', toggleSign, 'bg-accent text-accent-foreground')}
                {renderButton('%', inputPercent, 'bg-accent text-accent-foreground')}
                {renderButton('÷', () => performOperation('/'), 'bg-primary text-primary-foreground')}
                
                {renderButton('7', () => inputDigit('7'))}
                {renderButton('8', () => inputDigit('8'))}
                {renderButton('9', () => inputDigit('9'))}
                {renderButton('×', () => performOperation('*'), 'bg-primary text-primary-foreground')}

                {renderButton('4', () => inputDigit('4'))}
                {renderButton('5', () => inputDigit('5'))}
                {renderButton('6', () => inputDigit('6'))}
                {renderButton('-', () => performOperation('-'), 'bg-primary text-primary-foreground')}

                {renderButton('1', () => inputDigit('1'))}
                {renderButton('2', () => inputDigit('2'))}
                {renderButton('3', () => inputDigit('3'))}
                {renderButton('+', () => performOperation('+'), 'bg-primary text-primary-foreground')}

                {renderButton('0', () => inputDigit('0'), 'col-span-2')}
                {renderButton('.', inputDecimal)}
                {renderButton('=', handleEquals, 'bg-primary text-primary-foreground')}
            </div>
        </CardContent>
    </Card>
  );
}
