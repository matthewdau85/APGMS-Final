import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Label } from '../components/ui/label';
import type { UserRole } from '../types';
import clearComplianceLogo from 'figma:asset/8a7ebb110881b3f7461a797c8dd385db1dcbe559.png';

export const Login = () => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('Operator');
  const { setRole } = useAuth();
  const navigate = useNavigate();

  const handleLogin = () => {
    setRole(selectedRole);
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img 
              src={clearComplianceLogo} 
              alt="ClearCompliance - Tax obligations. Clearly handled." 
              className="h-24 w-auto"
            />
          </div>
          <CardDescription>
            <span className="text-xs mt-2 block">Demo Environment - Select Your Role</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup value={selectedRole} onValueChange={(val) => setSelectedRole(val as UserRole)}>
            <div className="space-y-3">
              <div className="flex items-start space-x-3 p-3 rounded-md hover:bg-muted cursor-pointer">
                <RadioGroupItem value="Operator" id="operator" />
                <div className="flex-1">
                  <Label htmlFor="operator" className="cursor-pointer font-medium">
                    Operator
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Perform operational tasks: create obligations, reconcile transactions, generate evidence packs
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 rounded-md hover:bg-muted cursor-pointer">
                <RadioGroupItem value="Admin" id="admin" />
                <div className="flex-1">
                  <Label htmlFor="admin" className="cursor-pointer font-medium">
                    Admin
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Full access: all operational tasks plus policy management, approval workflows, BAS lodgment
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 rounded-md hover:bg-muted cursor-pointer">
                <RadioGroupItem value="Auditor" id="auditor" />
                <div className="flex-1">
                  <Label htmlFor="auditor" className="cursor-pointer font-medium">
                    Auditor
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    View and verify: access all data, verify evidence packs, export audit trails (no edits)
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 p-3 rounded-md hover:bg-muted cursor-pointer">
                <RadioGroupItem value="Regulator" id="regulator" />
                <div className="flex-1">
                  <Label htmlFor="regulator" className="cursor-pointer font-medium">
                    Regulator
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Read-only access: view all data, verify compliance, export reports (no modifications)
                  </p>
                </div>
              </div>
            </div>
          </RadioGroup>

          <Button onClick={handleLogin} className="w-full" size="lg">
            Enter ClearCompliance as {selectedRole}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            This is a demo environment. All data is simulated and stored locally in your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};