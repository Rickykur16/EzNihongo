import 'package:go_router/go_router.dart';
import 'screens/home_screen.dart';
import 'screens/review_screen.dart';
import 'screens/detail_screen.dart';

GoRouter buildRouter() {
  return GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(
        path: '/',
        builder: (ctx, state) => const HomeScreen(),
      ),
      GoRoute(
        path: '/review/:level',
        builder: (ctx, state) {
          final level = state.pathParameters['level']!;
          return ReviewScreen(level: level);
        },
      ),
      GoRoute(
        path: '/kanji/:id',
        builder: (ctx, state) {
          final id = state.pathParameters['id']!;
          return DetailScreen(kanjiId: id);
        },
      ),
    ],
  );
}
