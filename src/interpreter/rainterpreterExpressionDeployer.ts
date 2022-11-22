import { DeployExpression, ValidInterpreter } from "../../generated/RainterpreterExpressionDeployer/RainterpreterExpressionDeployer"; 
import { ExpressionStateConfig } from "../../generated/schema";

// import {   getExpressionStateConfig } from "../utils";   

export function handleValidInterpreter(event: ValidInterpreter): void {
   
}

export function handleDeployExpression(event: DeployExpression): void {  

    let deployExpressionObject = new ExpressionStateConfig(event.transaction.hash.toHex());    

    deployExpressionObject.expressionAddress = event.params.expressionAddress;
    deployExpressionObject.sources = event.params.config.sources;
    deployExpressionObject.constants = event.params.config.constants; 

    deployExpressionObject.save() 
    
}  