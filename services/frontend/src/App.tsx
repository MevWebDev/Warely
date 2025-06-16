import { type FC } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import {
  Box,
  Container,
  Typography,
  Alert,
  AlertTitle,
  Button,
} from "@mui/material";
import { ApiOutlined } from "@mui/icons-material";
import { LoginButton, LoadingSpinner, LogoutButton } from "./components/Auth";
import { useAuthenticatedApi } from "./hooks/useAuthenticatedApi";
import logo from "./assets/logo.svg";

// Test API Call Component
const TestApiCall: FC = () => {
  const { apiCall } = useAuthenticatedApi();

  const testBackend = async (): Promise<void> => {
    try {
      const response = await apiCall("http://localhost:5000/hello");
      const data = await response.text();
      alert(`Backend Response: ${data}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      alert(`Error: ${errorMessage}`);
    }
  };

  return (
    <Box sx={{ mt: 3 }}>
      <Button
        variant="contained"
        color="success"
        onClick={testBackend}
        startIcon={<ApiOutlined />}
        size="large"
      >
        Test Backend API Call
      </Button>
    </Box>
  );
};

const App: FC = () => {
  const { isLoading, error, isAuthenticated } = useAuth0();

  return (
    <Container
      maxWidth={false}
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        padding: 0,
        margin: 0,
        backgroundColor: "black",
        color: "white",
      }}
    >
      {isLoading && <LoadingSpinner />}
      {error && (
        <Alert severity="error">
          <AlertTitle>Authentication Error</AlertTitle>
          {error.message}
        </Alert>
      )}
      {!isAuthenticated && !isLoading && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Box sx={{ width: 80, height: 80, mx: "auto" }}>
            <img src={logo} width="100%"></img>
          </Box>

          <Typography fontSize={36}>Login to access site</Typography>
          <LoginButton />
        </Box>
      )}
      {isAuthenticated && !isLoading && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
          }}
        >
          <Typography fontSize={64} textAlign={"center"} lineHeight={1}>
            Welcome to <br /> Warely
          </Typography>
          <LogoutButton />
          <TestApiCall />
        </Box>
      )}
    </Container>
  );
};

export default App;
