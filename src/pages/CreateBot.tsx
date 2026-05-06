import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Stepper,
  Step,
  StepLabel,
  CircularProgress,
  Alert,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Avatar,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  ContentCopy,
  CheckCircle,
  Error as ErrorIcon,
  Casino,
  CloudUpload,
} from '@mui/icons-material';
import { lemmyService } from '../services/lemmy';

function generatePassword(length = 24): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*-_=+';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join('');
}

interface ProgressStep {
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  error?: string;
}

export const CreateBot: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);

  // Form fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState(() => generatePassword());
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Captcha
  const [captchaRequired, setCaptchaRequired] = useState(false);
  const [captchaImage, setCaptchaImage] = useState<string | null>(null);
  const [captchaUuid, setCaptchaUuid] = useState<string | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState('');

  // Registration application answer
  const [requiresApplication, setRequiresApplication] = useState(false);
  const [applicationAnswer, setApplicationAnswer] = useState('Bot account created by admin');

  // Progress
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // Result
  const [resultUsername, setResultUsername] = useState('');
  const [resultPassword, setResultPassword] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    checkInstanceRequirements();
  }, []);

  async function checkInstanceRequirements() {
    try {
      // Check if captcha is required
      const captchaResp = await lemmyService.getCaptcha();
      if (captchaResp.ok) {
        setCaptchaRequired(true);
        setCaptchaImage(captchaResp.ok.png);
        setCaptchaUuid(captchaResp.ok.uuid);
      }

      // Check if registration applications are required
      const site = await lemmyService.getSite();
      if (site.site_view.local_site?.registration_mode === 'RequireApplication') {
        setRequiresApplication(true);
      }
    } catch (err) {
      console.error('Failed to check instance requirements:', err);
    }
  }

  function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = () => setAvatarPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  }

  function updateStep(index: number, update: Partial<ProgressStep>) {
    setProgressSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...update } : s)));
  }

  async function handleSubmit() {
    setFormError(null);

    if (!username.trim()) {
      setFormError('Username is required');
      return;
    }
    if (password.length < 10) {
      setFormError('Password must be at least 10 characters');
      return;
    }

    const steps: ProgressStep[] = [
      { label: 'Registering account', status: 'pending' },
      ...(requiresApplication ? [{ label: 'Approving registration', status: 'pending' as const }] : []),
      ...(avatarFile ? [{ label: 'Uploading avatar', status: 'pending' as const }] : []),
      { label: 'Configuring as bot', status: 'pending' },
    ];
    setProgressSteps(steps);
    setActiveStep(1);

    let stepIdx = 0;
    let botJwt: string | undefined;

    try {
      // Step 1: Register
      updateStep(stepIdx, { status: 'running' });
      const registerResp = await lemmyService.register({
        username: username.trim(),
        password,
        password_verify: password,
        email: email.trim() || undefined,
        captcha_uuid: captchaUuid || undefined,
        captcha_answer: captchaAnswer || undefined,
        answer: requiresApplication ? applicationAnswer : undefined,
      });
      botJwt = registerResp.jwt;
      updateStep(stepIdx, { status: 'done' });
      stepIdx++;

      // Step 2: Approve if needed
      if (requiresApplication) {
        updateStep(stepIdx, { status: 'running' });
        if (!botJwt) {
          // Need to find and approve the application
          const apps = await lemmyService.listRegistrationApplications(true);
          const app = apps.registration_applications.find(
            (a) => a.creator.name === username.trim()
          );
          if (app) {
            await lemmyService.approveRegistrationApplication({
              id: app.registration_application.id,
              approve: true,
            });
          }
          // Login as the bot (without saving to lemmyService)
          const loginResp = await lemmyService.loginRaw({
            username_or_email: username.trim(),
            password,
          });
          botJwt = loginResp.jwt;
        }
        updateStep(stepIdx, { status: 'done' });
        stepIdx++;
      }

      if (!botJwt) {
        throw new Error('Failed to obtain bot JWT after registration');
      }

      // Step 3: Upload avatar if provided
      let avatarUrl: string | undefined;
      if (avatarFile) {
        updateStep(stepIdx, { status: 'running' });
        const uploadResp = await lemmyService.uploadImageWithToken(avatarFile, botJwt);
        avatarUrl = uploadResp.url;
        updateStep(stepIdx, { status: 'done' });
        stepIdx++;
      }

      // Step 4: Configure as bot
      updateStep(stepIdx, { status: 'running' });
      await lemmyService.saveUserSettingsWithToken(
        {
          bot_account: true,
          display_name: displayName.trim() || undefined,
          bio: bio.trim() || undefined,
          avatar: avatarUrl,
        },
        botJwt
      );
      updateStep(stepIdx, { status: 'done' });

      // Success
      setResultUsername(username.trim());
      setResultPassword(password);
      setActiveStep(2);
    } catch (err: any) {
      const message = err.response?.data?.error || err.message || 'Unknown error';
      setProgressSteps((prev) =>
        prev.map((s, i) => (i === stepIdx ? { ...s, status: 'error', error: message } : s))
      );
    }
  }

  async function copyToClipboard(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  function handleCreateAnother() {
    setActiveStep(0);
    setUsername('');
    setPassword(generatePassword());
    setEmail('');
    setDisplayName('');
    setBio('');
    setAvatarFile(null);
    setAvatarPreview(null);
    setCaptchaAnswer('');
    setProgressSteps([]);
    setFormError(null);
    setResultUsername('');
    setResultPassword('');
    checkInstanceRequirements();
  }

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Create Bot Account
      </Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {['Configure Bot', 'Creating...', 'Done'].map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {/* Step 0: Form */}
      {activeStep === 0 && (
        <Card>
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {formError && <Alert severity="error">{formError}</Alert>}

            <TextField
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              fullWidth
              autoFocus
              helperText="Must be unique. Alphanumeric and underscores only."
            />

            <TextField
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                      <IconButton onClick={() => setPassword(generatePassword())} edge="end" title="Generate password">
                        <Casino />
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />

            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              helperText="Optional"
            />

            <TextField
              label="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              fullWidth
              helperText="Optional. Shown instead of username."
            />

            <TextField
              label="Bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              fullWidth
              multiline
              rows={3}
              helperText="Optional"
            />

            {/* Avatar upload */}
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Avatar (optional)
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {avatarPreview && (
                  <Avatar src={avatarPreview} sx={{ width: 64, height: 64 }} />
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={handleAvatarSelect}
                />
                <Button
                  variant="outlined"
                  startIcon={<CloudUpload />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {avatarFile ? 'Change' : 'Upload'}
                </Button>
                {avatarFile && (
                  <Button
                    size="small"
                    color="error"
                    onClick={() => {
                      setAvatarFile(null);
                      setAvatarPreview(null);
                    }}
                  >
                    Remove
                  </Button>
                )}
              </Box>
            </Box>

            {/* Captcha */}
            {captchaRequired && captchaImage && (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Captcha
                </Typography>
                <img
                  src={`data:image/png;base64,${captchaImage}`}
                  alt="captcha"
                  style={{ maxWidth: '100%', marginBottom: 8 }}
                />
                <TextField
                  label="Captcha Answer"
                  value={captchaAnswer}
                  onChange={(e) => setCaptchaAnswer(e.target.value)}
                  fullWidth
                  required
                />
              </Box>
            )}

            {/* Application answer */}
            {requiresApplication && (
              <TextField
                label="Registration Application Answer"
                value={applicationAnswer}
                onChange={(e) => setApplicationAnswer(e.target.value)}
                fullWidth
                helperText="This instance requires a registration application. It will be auto-approved."
              />
            )}

            <Button
              variant="contained"
              size="large"
              onClick={handleSubmit}
              disabled={!username.trim()}
              sx={{ mt: 1 }}
            >
              Create Bot Account
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Progress */}
      {activeStep === 1 && (
        <Card>
          <CardContent>
            <List>
              {progressSteps.map((step, i) => (
                <ListItem key={i}>
                  <ListItemIcon>
                    {step.status === 'running' && <CircularProgress size={24} />}
                    {step.status === 'done' && <CheckCircle color="success" />}
                    {step.status === 'error' && <ErrorIcon color="error" />}
                    {step.status === 'pending' && (
                      <CircularProgress size={24} variant="determinate" value={0} />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={step.label}
                    secondary={step.error}
                    secondaryTypographyProps={{ color: 'error' }}
                  />
                </ListItem>
              ))}
            </List>
            {progressSteps.some((s) => s.status === 'error') && (
              <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <Button variant="outlined" onClick={() => setActiveStep(0)}>
                  Back to Form
                </Button>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Success */}
      {activeStep === 2 && (
        <Card>
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Alert severity="success">Bot account created successfully!</Alert>

            <Typography variant="subtitle2" color="text.secondary">
              Save these credentials - the password cannot be recovered later.
            </Typography>

            <Box>
              <Typography variant="body2" color="text.secondary">
                Username
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                  variant="body1"
                  sx={{ fontFamily: 'monospace', bgcolor: 'action.hover', px: 1, py: 0.5, borderRadius: 1, flexGrow: 1 }}
                >
                  {resultUsername}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => copyToClipboard(resultUsername, 'username')}
                  color={copied === 'username' ? 'success' : 'default'}
                >
                  {copied === 'username' ? <CheckCircle /> : <ContentCopy />}
                </IconButton>
              </Box>
            </Box>

            <Box>
              <Typography variant="body2" color="text.secondary">
                Password
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                  variant="body1"
                  sx={{ fontFamily: 'monospace', bgcolor: 'action.hover', px: 1, py: 0.5, borderRadius: 1, flexGrow: 1, wordBreak: 'break-all' }}
                >
                  {resultPassword}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => copyToClipboard(resultPassword, 'password')}
                  color={copied === 'password' ? 'success' : 'default'}
                >
                  {copied === 'password' ? <CheckCircle /> : <ContentCopy />}
                </IconButton>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
              <Button variant="contained" onClick={handleCreateAnother}>
                Create Another
              </Button>
              <Button variant="outlined" href="/">
                Back to Dashboard
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};
