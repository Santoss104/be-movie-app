import { ICreditCard } from "../interfaces/card.interface";
import crypto from "crypto";

export class PaymentUtils {
  static validateCreditCard(cardDetails: ICreditCard): {
    isValid: boolean;
    error?: string;
  } {
    const isValidCardNumber = (number: string): boolean => {
      const digits = number.replace(/\D/g, "");
      let sum = 0;
      let isEven = false;

      for (let i = digits.length - 1; i >= 0; i--) {
        let digit = parseInt(digits[i]);
        if (isEven) {
          digit *= 2;
          if (digit > 9) {
            digit -= 9;
          }
        }
        sum += digit;
        isEven = !isEven;
      }
      return sum % 10 === 0;
    };

    const cleanCardNumber = cardDetails.cardNumber.replace(/[\s-]/g, "");

    if (!cleanCardNumber.match(/^\d{16}$/)) {
      return { isValid: false, error: "Invalid card number format" };
    }

    if (!isValidCardNumber(cleanCardNumber)) {
      return { isValid: false, error: "Invalid card number" };
    }

    if (!cardDetails.cardholderName.match(/^[a-zA-Z\s]{2,50}$/)) {
      return { isValid: false, error: "Invalid cardholder name" };
    }

    const currentYear = new Date().getFullYear() % 100;
    const expiryYear = parseInt(cardDetails.expiryYear);
    const expiryMonth = parseInt(cardDetails.expiryMonth);

    if (
      expiryYear < currentYear ||
      (expiryYear === currentYear && expiryMonth < new Date().getMonth() + 1)
    ) {
      return { isValid: false, error: "Card has expired" };
    }

    if (!cardDetails.cvv.match(/^\d{3,4}$/)) {
      return { isValid: false, error: "Invalid CVV" };
    }

    return { isValid: true };
  }

  static async processPayment(
    cardDetails: ICreditCard,
    amount: number
  ): Promise<{
    success: boolean;
    paymentVerificationId?: string;
    error?: string;
  }> {
    try {
      const validation = this.validateCreditCard(cardDetails);
      if (!validation.isValid) {
        return { success: false, error: validation.error };
      }

      const isPaymentSuccessful = await this.simulatePaymentGateway(
        cardDetails,
        amount
      );

      if (isPaymentSuccessful) {
        const paymentVerificationId = crypto.randomUUID();
        return {
          success: true,
          paymentVerificationId,
        };
      }

      return {
        success: false,
        error: "Payment processing failed",
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  private static async simulatePaymentGateway(
    cardDetails: ICreditCard,
    amount: number
  ): Promise<boolean> {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const lastFourDigits = cardDetails.cardNumber.slice(-4);
    return lastFourDigits !== "0000";
  }
}