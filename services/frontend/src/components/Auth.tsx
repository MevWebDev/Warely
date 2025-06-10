import { type FC } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { darken } from "@mui/material";
import {
  Button,
  Avatar,
  Box,
  Typography,
  CircularProgress,
  Stack,
} from "@mui/material";
import { Login, Logout } from "@mui/icons-material";

export const LoadingSpinner: FC = () => (
  <Box
    display="flex"
    justifyContent="center"
    alignItems="center"
    minHeight="100vh"
  >
    <Stack spacing={2} alignItems="center">
      <CircularProgress size={60} color="primary" />
      <Typography variant="h6" color="text.secondary">
        Loading...
      </Typography>
    </Stack>
  </Box>
);

export const LoginButton: FC = () => {
  const { loginWithRedirect, isAuthenticated } = useAuth0();

  if (isAuthenticated) return null;

  return (
    <Button
      variant="contained"
      color="primary"
      size="large"
      startIcon={<Login />}
      onClick={() => loginWithRedirect()}
      sx={{
        px: 4,
        backgroundColor: "white",
        color: "black",
        borderRadius: "0.5rem",
        "&:hover": { backgroundColor: darken("#FFFFFF", 0.1) },
      }}
    >
      Log In
    </Button>
  );
};

export const LogoutButton: FC = () => {
  const { logout, isAuthenticated } = useAuth0();

  if (!isAuthenticated) return null;

  return (
    <Button
      color="secondary"
      size="large"
      startIcon={<Logout />}
      onClick={() =>
        logout({ logoutParams: { returnTo: window.location.origin } })
      }
      sx={{
        px: 4,
        backgroundColor: "white",
        color: "black",
        borderRadius: "0.5rem",
        "&:hover": { backgroundColor: darken("#FFFFFF", 0.1) },
      }}
    >
      Log Out
    </Button>
  );
};

export const UserProfile: FC = () => {
  const { user, isAuthenticated } = useAuth0();

  if (!isAuthenticated || !user) return null;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1,
      }}
    >
      <Avatar src={user.picture} sx={{ width: 96, height: 96 }}></Avatar>
      <Box
        sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}
      >
        <Typography fontSize={32}>{user.name}</Typography>
        <Typography fontSize={18}>{user.email}</Typography>
      </Box>
      <LogoutButton />
    </Box>
  );
};
