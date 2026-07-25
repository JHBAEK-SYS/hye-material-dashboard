import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <form action="/auth/signout" method="post">
      <Button
        type="submit"
        variant="outline"
        size="sm"
        className="border-sidebar-border bg-transparent text-sidebar-foreground shadow-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        로그아웃
      </Button>
    </form>
  );
}
